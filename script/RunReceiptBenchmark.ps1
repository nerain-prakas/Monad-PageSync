$ErrorActionPreference = "Stop"

function Get-EnvValue([string]$name) {
    $line = Get-Content (Join-Path $PSScriptRoot "..\.env") |
        Where-Object { $_ -match ("^\s*" + [regex]::Escape($name) + "=") } |
        Select-Object -First 1
    if (-not $line) {
        throw "$name is missing from .env"
    }
    return $line.Substring($line.IndexOf("=") + 1).Trim().Trim('"').Trim("'")
}

function Get-HexNumber([string]$value) {
    if ($value -match "^0x") {
        return [Convert]::ToInt64($value.Substring(2), 16)
    }
    return [Int64]$value
}

function Send-Operation(
    [string]$contract,
    [string]$contractName,
    [string]$operation,
    [string]$signature,
    [string[]]$arguments,
    [string]$orderId
) {
    $output = & $cast send $contract $signature @arguments `
        --rpc-url $rpc --private-key $privateKey --async --json 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "$contractName $operation failed to send"
    }

    $hashMatch = ($output -join "`n") | Select-String -AllMatches -Pattern "0x[0-9a-fA-F]{64}"
    if (-not $hashMatch) {
        throw "$contractName $operation did not return a transaction hash"
    }
    $hash = $hashMatch.Matches[0].Value

    $receiptJson = & $cast receipt $hash --rpc-url $rpc --json 2>&1
    if ($LASTEXITCODE -ne 0) {
        throw "$contractName $operation receipt lookup failed"
    }
    $receipt = ($receiptJson -join "`n") | ConvertFrom-Json

    return [ordered]@{
        contract = $contractName
        run = if ($env:BENCHMARK_RUN) { [int]$env:BENCHMARK_RUN } else { 1 }
        operation = $operation
        orderId = [Int64]$orderId
        transactionHash = $hash
        blockNumber = Get-HexNumber $receipt.blockNumber
        status = Get-HexNumber $receipt.status
        gasUsed = Get-HexNumber $receipt.gasUsed
    }
}

$rpc = Get-EnvValue "MONAD_RPC_URL"
$privateKey = Get-EnvValue "PRIVATE_KEY"
if ($privateKey -notmatch "^(0x)?[0-9a-fA-F]{64}$") {
    throw "PRIVATE_KEY must contain 64 hexadecimal characters"
}
if ($privateKey -notmatch "^0x") {
    $privateKey = "0x" + $privateKey
}

$cast = if ($env:CAST_PATH) { $env:CAST_PATH } else { "cast" }

$naive = "0x9eDDb8B7612954014Af0fFA58dc9d93dB2C75d68"
$pagesync = "0x5De52bC09A2A688f6c4615099465e9049CC83bC1"
$sideBuy = "0"
$sideSell = "1"
$baseId = if ($env:BASE_ORDER_ID) { [Int64]$env:BASE_ORDER_ID } else { 910001 }
$firstId = "$baseId"
$secondId = "$($baseId + 1)"

$rows = @()
try {
    foreach ($book in @(
        @{ Name = "NaiveOrderBook"; Address = $naive },
        @{ Name = "PageSyncOrderBook"; Address = $pagesync }
    )) {
        $rows += Send-Operation $book.Address $book.Name "place" `
            "placeOrder(uint256,uint256,uint256,uint8)" @($firstId, "1000", "10", $sideBuy) $firstId
        $rows += Send-Operation $book.Address $book.Name "secondPlacement" `
            "placeOrder(uint256,uint256,uint256,uint8)" @($secondId, "2000", "20", $sideSell) $secondId
        $rows += Send-Operation $book.Address $book.Name "update" `
            "updateOrder(uint256,uint256,uint256)" @($firstId, "1010", "15") $firstId
        $rows += Send-Operation $book.Address $book.Name "cancel" `
            "cancelOrder(uint256)" @($firstId) $firstId
        $rows += Send-Operation $book.Address $book.Name "execute" `
            "executeTrade(uint256)" @($secondId) $secondId
    }
}
catch {
    $failurePath = Join-Path $PSScriptRoot "..\benchmark\results\receipt-benchmark-failure.json"
    [ordered]@{
        network = "monad-testnet"
        run = if ($env:BENCHMARK_RUN) { [int]$env:BENCHMARK_RUN } else { 1 }
        baseOrderId = $baseId
        completedTransactions = $rows
        error = $_.Exception.Message
    } | ConvertTo-Json -Depth 8 | Set-Content -Path $failurePath -Encoding utf8
    throw
}

$summary = foreach ($name in @("NaiveOrderBook", "PageSyncOrderBook")) {
    $gas = @($rows | Where-Object { $_.contract -eq $name } | ForEach-Object { [Int64]$_.gasUsed })
    [ordered]@{
        contract = $name
        totalGasUsed = ($gas | Measure-Object -Sum).Sum
        averageGasUsed = [Math]::Round(($gas | Measure-Object -Average).Average, 2)
        minimumGasUsed = ($gas | Measure-Object -Minimum).Minimum
        maximumGasUsed = ($gas | Measure-Object -Maximum).Maximum
    }
}

$result = [ordered]@{
    network = "monad-testnet"
    chainId = Get-HexNumber (& $cast chain-id --rpc-url $rpc)
    workload = @(
        "place order $firstId",
        "place order $secondId",
        "update order $firstId",
        "cancel order $firstId",
        "execute order $secondId"
    )
    transactions = $rows
    summary = $summary
}

$outputName = if ($env:BENCHMARK_OUTPUT) { $env:BENCHMARK_OUTPUT } else { "monad-receipt-benchmark.json" }
$outputPath = Join-Path $PSScriptRoot "..\benchmark\results\$outputName"
$result | ConvertTo-Json -Depth 6 | Set-Content -Path $outputPath -Encoding utf8
Write-Output "Receipt benchmark written to benchmark/results/$outputName"

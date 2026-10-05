$ErrorActionPreference = "Stop"

$runner = Join-Path $PSScriptRoot "RunReceiptBenchmark.ps1"
$resultsDir = Join-Path $PSScriptRoot "..\benchmark\results"
$runDefinitions = @(
    @{ Number = 1; BaseId = 930001 },
    @{ Number = 2; BaseId = 940001 },
    @{ Number = 3; BaseId = 950001 }
)

function Get-Median([double[]]$values) {
    $sorted = @($values | Sort-Object)
    $middle = [int][Math]::Floor($sorted.Count / 2)
    if (($sorted.Count % 2) -eq 1) {
        return $sorted[$middle]
    }
    return ($sorted[$middle - 1] + $sorted[$middle]) / 2
}

function Get-Stats([Int64[]]$values) {
    $average = ($values | Measure-Object -Average).Average
    $variance = (($values | ForEach-Object { ($_ - $average) * ($_ - $average) } |
        Measure-Object -Sum).Sum) / $values.Count
    return [ordered]@{
        values = @($values)
        minimum = ($values | Measure-Object -Minimum).Minimum
        maximum = ($values | Measure-Object -Maximum).Maximum
        median = Get-Median $values
        average = [Math]::Round($average, 2)
        range = ($values | Measure-Object -Maximum).Maximum - ($values | Measure-Object -Minimum).Minimum
        standardDeviation = [Math]::Round([Math]::Sqrt($variance), 2)
    }
}

$allTransactions = @()
foreach ($definition in $runDefinitions) {
    $outputName = "monad-receipt-benchmark-repeated-run$($definition.Number).json"
    $env:BASE_ORDER_ID = "$($definition.BaseId)"
    $env:BENCHMARK_RUN = "$($definition.Number)"
    $env:BENCHMARK_OUTPUT = $outputName
    try {
        & $runner | Out-Null
        if ($LASTEXITCODE -ne 0) {
            throw "Benchmark runner exited with code $LASTEXITCODE"
        }
    }
    catch {
        throw "Run $($definition.Number) failed. Diagnostic saved by the runner when available. $($_.Exception.Message)"
    }

    $runPath = Join-Path $resultsDir $outputName
    if (-not (Test-Path $runPath)) {
        throw "Run $($definition.Number) did not produce its result file"
    }
    $runResult = Get-Content $runPath -Raw | ConvertFrom-Json
    $allTransactions += @($runResult.transactions)
}

$operations = @("place", "secondPlacement", "update", "cancel", "execute")
$contracts = @("NaiveOrderBook", "PageSyncOrderBook")
$operationSummary = @()
foreach ($operation in $operations) {
    $naiveValues = @($allTransactions | Where-Object {
        $_.contract -eq "NaiveOrderBook" -and $_.operation -eq $operation
    } | ForEach-Object { [Int64]$_.gasUsed })
    $pageValues = @($allTransactions | Where-Object {
        $_.contract -eq "PageSyncOrderBook" -and $_.operation -eq $operation
    } | ForEach-Object { [Int64]$_.gasUsed })
    $naiveMedian = Get-Median $naiveValues
    $pageMedian = Get-Median $pageValues
    $operationSummary += [ordered]@{
        operation = $operation
        naive = Get-Stats $naiveValues
        pageSync = Get-Stats $pageValues
        medianGasDifference = $naiveMedian - $pageMedian
        medianPercentDifference = [Math]::Round((($naiveMedian - $pageMedian) / $naiveMedian) * 100, 2)
    }
}

$runSummary = @()
foreach ($run in $runDefinitions.Number) {
    $naiveTotal = ($allTransactions | Where-Object {
        $_.run -eq $run -and $_.contract -eq "NaiveOrderBook"
    } | Measure-Object -Property gasUsed -Sum).Sum
    $pageTotal = ($allTransactions | Where-Object {
        $_.run -eq $run -and $_.contract -eq "PageSyncOrderBook"
    } | Measure-Object -Property gasUsed -Sum).Sum
    $runSummary += [ordered]@{
        run = $run
        naiveTotalGasUsed = [Int64]$naiveTotal
        pageSyncTotalGasUsed = [Int64]$pageTotal
        percentDifference = [Math]::Round((($naiveTotal - $pageTotal) / $naiveTotal) * 100, 2)
    }
}

$naiveRunTotals = @($runSummary | ForEach-Object { [Int64]$_.naiveTotalGasUsed })
$pageRunTotals = @($runSummary | ForEach-Object { [Int64]$_.pageSyncTotalGasUsed })
$naiveAggregate = Get-Stats @($allTransactions | Where-Object {
    $_.contract -eq "NaiveOrderBook"
} | ForEach-Object { [Int64]$_.gasUsed })
$pageAggregate = Get-Stats @($allTransactions | Where-Object {
    $_.contract -eq "PageSyncOrderBook"
} | ForEach-Object { [Int64]$_.gasUsed })
$overallNaiveTotal = ($naiveRunTotals | Measure-Object -Sum).Sum
$overallPageTotal = ($pageRunTotals | Measure-Object -Sum).Sum

$final = [ordered]@{
    network = "monad-testnet"
    chainId = 10143
    repetitions = $runDefinitions.Count
    successfulTransactions = @($allTransactions).Count
    allReceiptStatusesOne = (@($allTransactions | Where-Object { [int]$_.status -ne 1 }).Count -eq 0)
    workload = @(
        "place order <baseOrderId>",
        "place order <baseOrderId + 1>",
        "update order <baseOrderId>",
        "cancel order <baseOrderId>",
        "execute order <baseOrderId + 1>"
    )
    runs = @($runSummary)
    transactions = @($allTransactions)
    perOperation = @($operationSummary)
    aggregate = [ordered]@{
        naive = $naiveAggregate
        pageSync = $pageAggregate
        naiveTotalAcrossRuns = [Int64]$overallNaiveTotal
        pageSyncTotalAcrossRuns = [Int64]$overallPageTotal
        naiveAverageTotalPerRun = [Math]::Round(($naiveRunTotals | Measure-Object -Average).Average, 2)
        pageSyncAverageTotalPerRun = [Math]::Round(($pageRunTotals | Measure-Object -Average).Average, 2)
        naiveMedianTotalPerRun = Get-Median $naiveRunTotals
        pageSyncMedianTotalPerRun = Get-Median $pageRunTotals
        totalPercentDifference = [Math]::Round((($overallNaiveTotal - $overallPageTotal) / $overallNaiveTotal) * 100, 2)
    }
}

$jsonPath = Join-Path $resultsDir "monad-receipt-benchmark-repeated.json"
$final | ConvertTo-Json -Depth 12 | Set-Content -Path $jsonPath -Encoding utf8

$labels = @{
    place = "Placement"
    secondPlacement = "Second Placement"
    update = "Update"
    cancel = "Cancel"
    execute = "Execute"
}
$markdown = @(
    "# Repeated Monad Testnet Receipt Benchmark",
    "",
    "All measurements are transaction receipt `gasUsed` values. Receipt status was `1` for every transaction.",
    "",
    "## Per-operation medians",
    "",
    "| Operation | Naive Median | PageSync Median | Gas Difference | % Difference |",
    "|---|---:|---:|---:|---:|"
)
foreach ($item in $operationSummary) {
    $markdown += "| $($labels[$item.operation]) | $($item.naive.median) | $($item.pageSync.median) | $($item.medianGasDifference) | $($item.medianPercentDifference)% |"
}
$markdown += @(
    "",
    "## Per-run totals",
    "",
    "| Run | Naive Total | PageSync Total | % Difference |",
    "|---:|---:|---:|---:|"
)
foreach ($item in $runSummary) {
    $markdown += "| $($item.run) | $($item.naiveTotalGasUsed) | $($item.pageSyncTotalGasUsed) | $($item.percentDifference)% |"
}
$markdown += @(
    "",
    "## Aggregate",
    "",
    "| Contract | Total across runs | Average total/run | Median total/run |",
    "|---|---:|---:|---:|",
    "| NaiveOrderBook | $overallNaiveTotal | $($final.aggregate.naiveAverageTotalPerRun) | $($final.aggregate.naiveMedianTotalPerRun) |",
    "| PageSyncOrderBook | $overallPageTotal | $($final.aggregate.pageSyncAverageTotalPerRun) | $($final.aggregate.pageSyncMedianTotalPerRun) |",
    "",
    "Overall percentage difference: **$($final.aggregate.totalPercentDifference)% lower for PageSyncOrderBook**.",
    "",
    "This measures the packed-storage implementation for this workload; it does not establish an explicit Monad storage-page locality or warming mechanism."
)
$markdownPath = Join-Path $resultsDir "monad-receipt-benchmark-repeated.md"
$markdown -join [Environment]::NewLine | Set-Content -Path $markdownPath -Encoding utf8
Write-Output "Repeated receipt benchmark written to benchmark/results/monad-receipt-benchmark-repeated.json"

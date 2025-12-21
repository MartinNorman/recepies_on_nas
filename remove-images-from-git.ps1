# Script to remove images/ folder from Git index
Write-Host "Removing images/ folder from Git index..."
Write-Host "This may take a few minutes for 5,283 files..."

# Get all image files
$imageFiles = git ls-files images/
$total = ($imageFiles | Measure-Object).Count
Write-Host "Found $total image files to remove"

# Process in batches of 50
$batchSize = 50
$processed = 0
$batches = [math]::Ceiling($total / $batchSize)

for ($i = 0; $i -lt $batches; $i++) {
    $batch = $imageFiles | Select-Object -Skip ($i * $batchSize) -First $batchSize
    $batch | ForEach-Object {
        git update-index --remove $_ 2>&1 | Out-Null
    }
    $processed += $batch.Count
    $percent = [math]::Round(($processed / $total) * 100, 1)
    Write-Progress -Activity "Removing images from Git" -Status "Processed $processed of $total files" -PercentComplete $percent
}

Write-Host "`nDone! Verifying..."
$remaining = (git ls-files images/ | Measure-Object).Count
if ($remaining -eq 0) {
    Write-Host "SUCCESS: All image files removed from Git index" -ForegroundColor Green
} else {
    Write-Host "WARNING: $remaining files still remain" -ForegroundColor Yellow
}


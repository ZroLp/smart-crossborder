$files = Get-ChildItem app,components -Recurse -Filter *.tsx | Where-Object { $_.FullName -notlike '*\api\*' -and $_.FullName -notlike '*\lib\*' }
$hits = $files | Select-String -Pattern '[\u4e00-\u9fff]'
if ($hits) {
  $hits | ForEach-Object { Write-Output ($_.Path + ':' + $_.LineNumber) }
} else { Write-Output 'NO CJK FOUND' }

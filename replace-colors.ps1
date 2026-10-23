$files = @(
  'app\dashboard\settings\page.tsx',
  'app\admin\users\page.tsx',
  'app\admin\layout.tsx',
  'app\dashboard\layout.tsx',
  'components\Sidebar.tsx',
  'components\TopBar.tsx'
)

$replacements = [ordered]@{
  'dark:bg-[#1D1D1D]' = 'dark:bg-[#181A20]'
  'dark:bg-[#141414]' = 'dark:bg-[#0F1117]'
  'dark:text-[#E5E6EB]' = 'dark:text-[#E8EAED]'
  'dark:text-[#C9CDD4]' = 'dark:text-[#A0A4AC]'
  'dark:border-[#2E2E2E]' = 'dark:border-[#2A2D35]'
  'dark:hover:bg-[#2A2A2A]' = 'dark:hover:bg-[#22252D]'
  'dark:bg-[#2A2A2A]' = 'dark:bg-[#22252D]'
  'dark:bg-[#2E2E2E]' = 'dark:bg-[#1E2028]'
  'dark:divide-[#2E2E2E]' = 'dark:divide-[#2A2D35]'
  'dark:divide-[#2A2A2A]' = 'dark:divide-[#22252D]'
}

foreach ($file in $files) {
  $path = Join-Path $PSScriptRoot $file
  if (Test-Path $path) {
    $content = Get-Content $path -Raw -Encoding UTF8
    $original = $content
    foreach ($old in $replacements.Keys) {
      $new = $replacements[$old]
      $content = $content.Replace($old, $new)
    }
    if ($content -ne $original) {
      Set-Content -Path $path -Value $content -Encoding UTF8 -NoNewline
      Write-Host "UPDATED: $file"
    } else {
      Write-Host "NO CHANGES: $file"
    }
  } else {
    Write-Host "NOT FOUND: $file"
  }
}

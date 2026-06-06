param(
  [int]$Port = 5173,
  [string]$Root = (Get-Location).Path
)

$listener = [System.Net.HttpListener]::new()
$listener.Prefixes.Add("http://127.0.0.1:$Port/")
$listener.Start()
Write-Host "Serving $Root at http://127.0.0.1:$Port/"

$mime = @{
  ".html" = "text/html; charset=utf-8"
  ".js" = "text/javascript; charset=utf-8"
  ".css" = "text/css; charset=utf-8"
  ".csv" = "text/csv; charset=utf-8"
  ".gz" = "application/gzip"
  ".parquet" = "application/octet-stream"
}

while ($listener.IsListening) {
  $context = $listener.GetContext()
  try {
    $path = [Uri]::UnescapeDataString($context.Request.Url.AbsolutePath.TrimStart("/"))
    if ([string]::IsNullOrWhiteSpace($path)) { $path = "static-preview.html" }
    $fullPath = [System.IO.Path]::GetFullPath([System.IO.Path]::Combine($Root, $path))
    $rootPath = [System.IO.Path]::GetFullPath($Root)

    if (-not $fullPath.StartsWith($rootPath, [System.StringComparison]::OrdinalIgnoreCase) -or -not [System.IO.File]::Exists($fullPath)) {
      $context.Response.StatusCode = 404
      $bytes = [System.Text.Encoding]::UTF8.GetBytes("Not found")
    } else {
      $context.Response.StatusCode = 200
      $ext = [System.IO.Path]::GetExtension($fullPath)
      $context.Response.ContentType = $mime[$ext]
      if (-not $context.Response.ContentType) { $context.Response.ContentType = "application/octet-stream" }
      $bytes = [System.IO.File]::ReadAllBytes($fullPath)
    }

    $context.Response.ContentLength64 = $bytes.Length
    $context.Response.OutputStream.Write($bytes, 0, $bytes.Length)
  } catch {
    $context.Response.StatusCode = 500
  } finally {
    $context.Response.OutputStream.Close()
  }
}

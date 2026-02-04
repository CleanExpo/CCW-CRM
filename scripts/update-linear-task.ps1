$apiKey = $env:LINEAR_API_KEY

if (-not $apiKey) {
    Write-Host "ERROR: LINEAR_API_KEY environment variable not set"
    exit 1
}

Write-Host "Updating Linear task #68 to Completed..."

$headers = @{
    'Authorization' = $apiKey
    'Content-Type' = 'application/json'
}

$body = @{
    query = 'mutation { issueUpdate(id: "d72b4cf3-1ab6-4f9a-b90a-d7ee3dfe4e43", input: { stateId: "dbd25a3e-d4f0-4e82-a080-2cdce1e4e4e7" }) { success issue { id title state { name } } } }'
} | ConvertTo-Json

try {
    $response = Invoke-RestMethod -Uri 'https://api.linear.app/graphql' -Method Post -Headers $headers -Body $body
    if ($response.data.issueUpdate.success) {
        Write-Host "✅ Task updated successfully: $($response.data.issueUpdate.issue.title) -> $($response.data.issueUpdate.issue.state.name)"
    } else {
        Write-Host "❌ Task update failed"
        $response | ConvertTo-Json -Depth 10
    }
} catch {
    Write-Host "❌ Error: $_"
    exit 1
}

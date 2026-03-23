$baseUrl = "http://localhost:5186/api"

# 1. Register 5 dummy employees
$employees = @(
    @{ EmpNo="2001"; FullName="Amit Kumar"; Department="IT"; Password="Pass123!"; Role="Employee" },
    @{ EmpNo="2002"; FullName="Sanjay Singh"; Department="Finance"; Password="Pass123!"; Role="Employee" },
    @{ EmpNo="2003"; FullName="Priya Sharma"; Department="HR"; Password="Pass123!"; Role="Employee" },
    @{ EmpNo="2004"; FullName="Rahul Verma"; Department="Operations"; Password="Pass123!"; Role="Employee" },
    @{ EmpNo="2005"; FullName="Anjali Gupta"; Department="Sales"; Password="Pass123!"; Role="Employee" }
)

Write-Host "Registering employees..."
foreach ($emp in $employees) {
    try {
        Invoke-RestMethod -Uri "$baseUrl/Auth/register" -Method Post -ContentType "application/json" -Body ($emp | ConvertTo-Json)
        Write-Host "Registered $($emp.EmpNo)"
    } catch {
        Write-Host "Failed to register $($emp.EmpNo) (might already exist)"
    }
}

# 2. Register a temporary Admin user to get a token
$adminCreds = @{ EmpNo="9999"; FullName="Temp Admin"; Department="Admin"; Password="Pass123!"; Role="Admin" }
try {
    Invoke-RestMethod -Uri "$baseUrl/Auth/register" -Method Post -ContentType "application/json" -Body ($adminCreds | ConvertTo-Json)
} catch {}

# 3. Login as Admin
$loginData = @{ EmpNo="9999"; Password="Pass123!" }
$loginResponse = Invoke-RestMethod -Uri "$baseUrl/Auth/login" -Method Post -ContentType "application/json" -Body ($loginData | ConvertTo-Json)
$token = $loginResponse.token

# 4. Insert 5 dummy inventory items assigned to the dummy employees
$headers = @{ "Authorization" = "Bearer $token" }

$inventoryItems = @(
    @{ MakeAndModel="Dell Latitude 5420"; ProductType="Laptop"; SerialNo="DL12345"; Qty=1; Status="Issued"; IssuedDate="2026-03-09T00:00:00Z"; EmpNo="2001"; CurrentlyIssuedTo="Amit Kumar" },
    @{ MakeAndModel="HP ProDesk 400"; ProductType="Desktop"; SerialNo="HP54321"; Qty=1; Status="Issued"; IssuedDate="2026-02-19T00:00:00Z"; EmpNo="2002"; CurrentlyIssuedTo="Sanjay Singh" },
    @{ MakeAndModel="Lenovo ThinkPad T14"; ProductType="Laptop"; SerialNo="LN98765"; Qty=1; Status="Issued"; IssuedDate="2026-03-14T00:00:00Z"; EmpNo="2003"; CurrentlyIssuedTo="Priya Sharma" },
    @{ MakeAndModel="Apple MacBook Pro M2"; ProductType="Laptop"; SerialNo="APL1122"; Qty=1; Status="Issued"; IssuedDate="2026-02-09T00:00:00Z"; EmpNo="2004"; CurrentlyIssuedTo="Rahul Verma" },
    @{ MakeAndModel="Dell OptiPlex 7090"; ProductType="Desktop"; SerialNo="DL55678"; Qty=1; Status="Issued"; IssuedDate="2026-03-04T00:00:00Z"; EmpNo="2005"; CurrentlyIssuedTo="Anjali Gupta" }
)

Write-Host "Adding inventory items..."
foreach ($item in $inventoryItems) {
    try {
        Invoke-RestMethod -Uri "$baseUrl/Inventory" -Method Post -Headers $headers -ContentType "application/json" -Body ($item | ConvertTo-Json)
        Write-Host "Added inventory for $($item.EmpNo)"
    } catch {
        Write-Host "Failed to add inventory for $($item.EmpNo)"
    }
}
Write-Host "API Data Seeding Complete."

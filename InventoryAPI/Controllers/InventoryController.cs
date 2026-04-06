using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using InventoryAPI.Data;
using InventoryAPI.Models;
using Microsoft.EntityFrameworkCore;
using System.Security.Claims;
using ClosedXML.Excel;
using System.IO;
using Microsoft.Extensions.Logging;

namespace InventoryAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class InventoryController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<InventoryController> _logger;

    public InventoryController(AppDbContext context, ILogger<InventoryController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet]
    [Authorize]
    public async Task<IActionResult> GetAll()
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        var empNo = User.FindFirstValue(ClaimTypes.Name);

        if (role == "Admin")
        {
            return Ok(await _context.Inventories.ToListAsync());
        }
        
        return Ok(await _context.Inventories
            .Where(item => item.EmpNo == empNo)
            .ToListAsync());
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Create(Inventory newItem)
    {
        newItem.CreatedAt = DateTime.Now;
        newItem.UpdatedAt = DateTime.Now;

        _context.Inventories.Add(newItem);
        await _context.SaveChangesAsync();

        if (newItem.Status == "Issued")
        {
            var historyRecord = new AssetIssueHistory
            {
                InventoryId = newItem.Id,
                EmpNo = newItem.EmpNo,
                IssuedTo = newItem.CurrentlyIssuedTo,
                IssueDate = newItem.IssuedDate ?? DateTime.Now,
                Status = "Issued",
                ReferenceFileNo = newItem.ReferenceFileNo,
                Remarks = newItem.Remarks
            };
            
            _context.AssetIssueHistories.Add(historyRecord);
            await _context.SaveChangesAsync();
        }

        var loggedUser = User.FindFirstValue(ClaimTypes.Name);
        _logger.LogInformation("User {User} created new inventory item: {MakeAndModel}", loggedUser, newItem.MakeAndModel);

        return Ok(newItem);
    }

    [HttpPut("{id}")]
    [Authorize]
    public async Task<IActionResult> UpdateItem(int id, Inventory updatedData)
    {
        var dbItem = await _context.Inventories.FindAsync(id);
        if (dbItem == null) return NotFound("Asset not found");

        var currentUserRole = User.FindFirstValue(ClaimTypes.Role);
        var currentUserEmpNo = User.FindFirstValue(ClaimTypes.Name);

        // Security check: only admins or the person holding the asset can update it
        if (currentUserRole != "Admin" && dbItem.EmpNo != currentUserEmpNo)
        {
            _logger.LogWarning("Unauthorized update attempt on asset {AssetId} by user {EmpNo}", id, currentUserEmpNo);
            return Forbid();
        }

        // Logic to track assignment changes cleanly
        bool isAssigneeChanged = dbItem.EmpNo != updatedData.EmpNo || dbItem.CurrentlyIssuedTo != updatedData.CurrentlyIssuedTo;
        bool isStatusChanged = dbItem.Status != updatedData.Status;

        if (isStatusChanged || isAssigneeChanged)
        {
            // If there's an active history record, close it since the assignment or status is changing
            var activeRecord = await _context.AssetIssueHistories
                .Where(h => h.InventoryId == dbItem.Id && h.SubmitDate == null)
                .OrderByDescending(h => h.IssueDate)
                .FirstOrDefaultAsync();

            if (activeRecord != null)
            {
                activeRecord.SubmitDate = DateTime.Now;
                activeRecord.Status = "Returned";
            }

            // If the new status is "Issued", create a fresh historical record
            if (updatedData.Status == "Issued")
            {
                var newRecord = new AssetIssueHistory
                {
                    InventoryId = dbItem.Id,
                    EmpNo = updatedData.EmpNo,
                    IssuedTo = updatedData.CurrentlyIssuedTo,
                    IssueDate = updatedData.IssuedDate ?? DateTime.Now,
                    Status = "Issued",
                    ReferenceFileNo = updatedData.ReferenceFileNo,
                    Remarks = updatedData.Remarks
                };
                _context.AssetIssueHistories.Add(newRecord);
            }
        }
        else if (updatedData.Status == "Issued")
        {
            // Status and Assignee didn't change, but admin might be updating remarks or file no
            var activeRecord = await _context.AssetIssueHistories
                .Where(h => h.InventoryId == dbItem.Id && h.SubmitDate == null)
                .OrderByDescending(h => h.IssueDate)
                .FirstOrDefaultAsync();

            if (activeRecord != null)
            {
                // We STRICTLY do NOT update IssueDate, EmpNo, or IssuedTo here 
                // to prevent data loss. Only minor text fields should sync.
                activeRecord.ReferenceFileNo = updatedData.ReferenceFileNo;
                activeRecord.Remarks = updatedData.Remarks;
            }
        }

        // Apply general updates
        dbItem.SerialNo = updatedData.SerialNo;
        dbItem.ProductType = updatedData.ProductType;
        dbItem.MakeAndModel = updatedData.MakeAndModel;
        dbItem.PurchaseDate = updatedData.PurchaseDate;
        dbItem.Qty = updatedData.Qty;
        dbItem.StockRegister = updatedData.StockRegister;
        dbItem.AssetId = updatedData.AssetId;
        dbItem.Status = updatedData.Status;

        // Clean up assignee info if it's returning to Available
        if (updatedData.Status == "Available")
        {
            dbItem.CurrentlyIssuedTo = null;
            dbItem.EmpNo = null;
            dbItem.IssuedDate = null;
        }
        else
        {
            dbItem.CurrentlyIssuedTo = updatedData.CurrentlyIssuedTo;
            dbItem.EmpNo = updatedData.EmpNo;
            dbItem.IssuedDate = updatedData.IssuedDate;
        }

        dbItem.ReferenceFileNo = updatedData.ReferenceFileNo;
        dbItem.InventoryLocation = updatedData.InventoryLocation;
        dbItem.Specifications = updatedData.Specifications;
        dbItem.Remarks = updatedData.Remarks;
        dbItem.UpdatedAt = DateTime.Now;

        await _context.SaveChangesAsync();
        
        _logger.LogInformation("Asset {Id} updated by user {User}", dbItem.Id, currentUserEmpNo);
        return Ok(dbItem);
    }

    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> RemoveItem(int id)
    {
        var item = await _context.Inventories.FindAsync(id);
        if (item == null) return NotFound();

        _context.Inventories.Remove(item);
        await _context.SaveChangesAsync();
        
        var currentUserEmpNo = User.FindFirstValue(ClaimTypes.Name);
        _logger.LogInformation("Asset {Id} deleted by user {User}", id, currentUserEmpNo);
        
        return Ok("Deleted");
    }

    [HttpGet("export")]
    [Authorize]
    public async Task<IActionResult> ExportToExcel([FromQuery] string type = "All")
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        var empNo = User.FindFirstValue(ClaimTypes.Name);

        IQueryable<Inventory> query = _context.Inventories;

        if (role != "Admin")
        {
            query = query.Where(item => item.EmpNo == empNo);
        }

        var items = await query.ToListAsync();

        if (!string.IsNullOrEmpty(type) && type != "All")
        {
            if (type == "Other")
            {
                var knownTypes = new[] { "laptop", "desktop", "printer", "scanner", "pendrive" };
                items = items.Where(i => i.ProductType == null || !knownTypes.Any(kt => i.ProductType.ToLower().Contains(kt))).ToList();
            }
            else
            {
                items = items.Where(i => i.ProductType != null && i.ProductType.Contains(type, StringComparison.OrdinalIgnoreCase)).ToList();
            }
        }

        using var workbook = new XLWorkbook();
        var worksheet = workbook.Worksheets.Add("Inventory Report");

        var headers = new[] { "ID", "Type", "Sys S.No", "Make & Model", "Purchase Date", "Qty", "Stock Register", "Asset ID", "Status", "Issued To", "Emp No", "Issued Date", "Ref File", "Location", "Specifications", "Remarks" };
        for (int i = 0; i < headers.Length; i++)
        {
            worksheet.Cell(1, i + 1).Value = headers[i];
            worksheet.Cell(1, i + 1).Style.Font.Bold = true;
        }

        for (int i = 0; i < items.Count; i++)
        {
            var item = items[i];
            int row = i + 2;
            worksheet.Cell(row, 1).Value = item.Id;
            worksheet.Cell(row, 2).Value = item.ProductType ?? "-";
            worksheet.Cell(row, 3).Value = item.SerialNo ?? "-";
            worksheet.Cell(row, 4).Value = item.MakeAndModel ?? "-";
            worksheet.Cell(row, 5).Value = item.PurchaseDate?.ToString("yyyy-MM-dd") ?? "-";
            worksheet.Cell(row, 6).Value = item.Qty;
            worksheet.Cell(row, 7).Value = item.StockRegister ?? "-";
            worksheet.Cell(row, 8).Value = item.AssetId ?? "-";
            worksheet.Cell(row, 9).Value = item.Status ?? "-";
            worksheet.Cell(row, 10).Value = item.CurrentlyIssuedTo ?? "-";
            worksheet.Cell(row, 11).Value = item.EmpNo ?? "-";
            worksheet.Cell(row, 12).Value = item.IssuedDate?.ToString("yyyy-MM-dd") ?? "-";
            worksheet.Cell(row, 13).Value = item.ReferenceFileNo ?? "-";
            worksheet.Cell(row, 14).Value = item.InventoryLocation ?? "-";
            worksheet.Cell(row, 15).Value = item.Specifications ?? "-";
            worksheet.Cell(row, 16).Value = item.Remarks ?? "-";
        }

        worksheet.Columns().AdjustToContents();

        using var stream = new MemoryStream();
        workbook.SaveAs(stream);
        var content = stream.ToArray();

        // Prevent header injection / path traversal by sanitizing the type input
        string safeType = string.Join("_", type.Split(Path.GetInvalidFileNameChars()));
        string fileName = $"TCIL_Inventory_Report_{safeType}_{DateTime.Now:yyyy-MM-dd}.xlsx";
        
        _logger.LogInformation("User {User} exported Excel report for type: {safeType}", empNo, safeType);

        Response.Headers.Append("Content-Disposition", $"attachment; filename=\"{fileName}\"");
        return File(content, "application/vnd.openxmlformats-officedocument.spreadsheetml.sheet", fileName);
    }
}
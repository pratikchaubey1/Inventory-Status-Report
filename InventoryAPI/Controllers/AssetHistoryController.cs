using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using InventoryAPI.Data;
using InventoryAPI.Models;
using Microsoft.EntityFrameworkCore;

namespace InventoryAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AssetHistoryController : ControllerBase
{
    private readonly AppDbContext _context;

    public AssetHistoryController(AppDbContext context)
    {
        _context = context;
    }

    [HttpGet("{inventoryId}")]
    [Authorize]
    public async Task<IActionResult> GetHistory(int inventoryId)
    {
        var history = await _context.AssetIssueHistories
            .Where(h => h.InventoryId == inventoryId)
            .OrderBy(h => h.IssueDate)
            .ToListAsync();
        
        return Ok(history);
    }

    [HttpPost]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> AddHistory(AssetIssueHistory history)
    {
        _context.AssetIssueHistories.Add(history);
        await _context.SaveChangesAsync();
        return Ok(history);
    }
}

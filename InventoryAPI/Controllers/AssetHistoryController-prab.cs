using System.Security.Claims;
using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using InventoryAPI.Data;
using InventoryAPI.Models;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace InventoryAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AssetHistoryController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<AssetHistoryController> _logger;

    public AssetHistoryController(AppDbContext context, ILogger<AssetHistoryController> logger)
    {
        _context = context;
        _logger = logger;
    }

    [HttpGet("{inventoryId}")]
    [Authorize]
    public async Task<IActionResult> GetHistory(int inventoryId)
    {
        var role = User.FindFirstValue(ClaimTypes.Role);
        var empNo = User.FindFirstValue(ClaimTypes.Name);

        if (role != "Admin")
        {
            var asset = await _context.Inventories.FindAsync(inventoryId);
            if (asset == null || asset.EmpNo != empNo)
            {
                _logger.LogWarning("Unauthorized access attempt to history of asset {InventoryId} by user {EmpNo}", inventoryId, empNo);
                return Forbid();
            }
        }

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
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        _context.AssetIssueHistories.Add(history);
        await _context.SaveChangesAsync();
        
        _logger.LogInformation("Added manual history record for asset {InventoryId}", history.InventoryId);
        return Ok(history);
    }
}

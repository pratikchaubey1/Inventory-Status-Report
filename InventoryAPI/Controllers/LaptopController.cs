using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using Microsoft.EntityFrameworkCore;
using InventoryAPI.Data;
using InventoryAPI.Models;
using Microsoft.Extensions.Logging;

namespace InventoryAPI.Controllers;

[Route("api/[controller]")]
[ApiController]
[Authorize] // Secure all endpoints by default
public class LaptopController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ILogger<LaptopController> _logger;

    public LaptopController(AppDbContext context, ILogger<LaptopController> logger)
    {
        _context = context;
        _logger = logger;
    }

    // GET: api/laptop
    [HttpGet]
    public async Task<ActionResult<IEnumerable<Laptop>>> GetLaptops()
    {
        return await _context.Laptops.ToListAsync();
    }

    // POST: api/laptop
    [HttpPost]
    [Authorize(Roles = "Admin")] // Only Admins can add
    public async Task<ActionResult<Laptop>> AddLaptop(Laptop laptop)
    {
        if (!ModelState.IsValid)
        {
            return BadRequest(ModelState);
        }

        _context.Laptops.Add(laptop);
        await _context.SaveChangesAsync();
        
        _logger.LogInformation("New laptop added: {Id}", laptop.Id);
        return Ok(laptop);
    }

    // DELETE: api/laptop/5
    [HttpDelete("{id}")]
    [Authorize(Roles = "Admin")] // Only Admins can delete
    public async Task<IActionResult> DeleteLaptop(int id)
    {
        var laptop = await _context.Laptops.FindAsync(id);
        if (laptop == null)
        {
            _logger.LogWarning("Failed delete attempt. Laptop not found: {Id}", id);
            return NotFound();
        }

        _context.Laptops.Remove(laptop);
        await _context.SaveChangesAsync();

        _logger.LogInformation("Laptop deleted by Admin: {Id}", id);
        return NoContent();
    }
}
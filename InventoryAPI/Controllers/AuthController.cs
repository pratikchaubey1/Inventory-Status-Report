using Microsoft.AspNetCore.Mvc;
using InventoryAPI.Data;
using InventoryAPI.DTOs;
using InventoryAPI.Models;
using InventoryAPI.Services;
using Microsoft.EntityFrameworkCore;

namespace InventoryAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ITokenService _tokenService;

    public AuthController(AppDbContext context, ITokenService tokenService)
    {
        _context = context;
        _tokenService = tokenService;
    }

    [HttpPost("register")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.EmpNo == request.EmpNo);
        if (existingUser != null)
        {
            return BadRequest("An employee with this Employee Number already exists.");
        }

        var user = new User
        {
            EmpNo = request.EmpNo,
            FullName = request.FullName,
            Department = request.Department,
            PasswordHash = BCrypt.Net.BCrypt.HashPassword(request.Password),
            Role = Enum.Parse<UserRole>(request.Role)
        };

        _context.Users.Add(user);
        await _context.SaveChangesAsync();

        return Ok("User Created");
    }

    [HttpGet("employee/{empNo}")]
    public async Task<IActionResult> GetEmployee(string empNo)
    {
        var user = await _context.Users
            .Where(u => u.EmpNo == empNo)
            .Select(u => new { u.FullName, u.Department })
            .FirstOrDefaultAsync();

        if (user == null) return NotFound("Employee not found");
        return Ok(user);
    }

    [HttpPost("login")]
    public async Task<IActionResult> Login(LoginRequest request)
    {
        var user = await _context.Users
            .FirstOrDefaultAsync(x => x.EmpNo == request.EmpNo);

        if (user == null || !BCrypt.Net.BCrypt.Verify(request.Password, user.PasswordHash))
        {
            return Unauthorized();
        }

        var token = _tokenService.CreateToken(user);
        return Ok(new { token, role = user.Role.ToString(), fullName = user.FullName });
    }

    [HttpGet("users")]
    public async Task<IActionResult> GetUsers()
    {
        var users = await _context.Users.ToListAsync();
        return Ok(users);
    }
}
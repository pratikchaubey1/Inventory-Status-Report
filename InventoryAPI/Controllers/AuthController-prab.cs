using Microsoft.AspNetCore.Authorization;
using Microsoft.AspNetCore.Mvc;
using InventoryAPI.Data;
using InventoryAPI.DTOs;
using InventoryAPI.Models;
using InventoryAPI.Services;
using Microsoft.EntityFrameworkCore;
using Microsoft.Extensions.Logging;

namespace InventoryAPI.Controllers;

[ApiController]
[Route("api/[controller]")]
public class AuthController : ControllerBase
{
    private readonly AppDbContext _context;
    private readonly ITokenService _tokenService;
    private readonly ILogger<AuthController> _logger;

    public AuthController(AppDbContext context, ITokenService tokenService, ILogger<AuthController> logger)
    {
        _context = context;
        _tokenService = tokenService;
        _logger = logger;
    }

    [HttpPost("register")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> Register(RegisterRequest request)
    {
        var existingUser = await _context.Users.FirstOrDefaultAsync(u => u.EmpNo == request.EmpNo);
        if (existingUser != null)
        {
            _logger.LogWarning("Registration failed: Employee {EmpNo} already exists.", request.EmpNo);
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

        _logger.LogInformation("New user registered successfully: {EmpNo} with role {Role}", user.EmpNo, user.Role);
        return Ok("User Created");
    }

    [HttpGet("employee/{empNo}")]
    [Authorize(Roles = "Admin")]
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
            _logger.LogWarning("Failed login attempt for employee: {EmpNo}", request.EmpNo);
            // Do not expose whether the user exists or the password was wrong
            return Unauthorized("Invalid Employee Number or Password.");
        }

        var token = _tokenService.CreateToken(user);
        _logger.LogInformation("Successful login for employee: {EmpNo}", request.EmpNo);
        return Ok(new { token, role = user.Role.ToString(), fullName = user.FullName });
    }

    [HttpGet("users")]
    [Authorize(Roles = "Admin")]
    public async Task<IActionResult> GetUsers()
    {
        // Return only mapped safe properties to avoid leaking PasswordHash
        var users = await _context.Users
            .Select(u => new UserDto 
            {
                Id = u.Id,
                EmpNo = u.EmpNo,
                FullName = u.FullName,
                Department = u.Department,
                Role = u.Role.ToString()
            })
            .ToListAsync();
            
        return Ok(users);
    }
}
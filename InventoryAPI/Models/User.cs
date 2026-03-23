using System.ComponentModel.DataAnnotations;

namespace InventoryAPI.Models;

public class User
{
    public int Id { get; set; }

    [Required]
    public string EmpNo { get; set; } // Replaced Username with Employee Number
    
    public string? FullName { get; set; }
    
    public string? Department { get; set; }

    [Required]
    public string PasswordHash { get; set; }

    public UserRole Role { get; set; }
}
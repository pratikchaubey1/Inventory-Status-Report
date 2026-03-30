namespace InventoryAPI.DTOs;

public class UserDto
{
    public int Id { get; set; }
    public string EmpNo { get; set; }
    public string? FullName { get; set; }
    public string? Department { get; set; }
    public string Role { get; set; }
}

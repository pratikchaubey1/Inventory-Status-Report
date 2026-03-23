namespace InventoryAPI.DTOs
{
    public class RegisterRequest
    {
        public string EmpNo { get; set; }
        public string? FullName { get; set; }
        public string? Department { get; set; }
        public string Password { get; set; }
        public string Role { get; set; }
    }
}
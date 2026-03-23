namespace InventoryAPI.Models
{
    public class Laptop
    {
        public int Id { get; set; }
        public string EmployeeId { get; set; }
        public string Model { get; set; }
        public DateTime ReceivingDate { get; set; }
        public DateTime? SubmitDate { get; set; }
        public string Status { get; set; }
    }
}
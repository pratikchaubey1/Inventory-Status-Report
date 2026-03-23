using System;

namespace InventoryAPI.Models;

public class Inventory
{
    public int Id { get; set; }
    public string? SerialNo { get; set; }
    public string ProductType { get; set; } // e.g. Laptop/Desktop
    public string MakeAndModel { get; set; }
    public DateTime? PurchaseDate { get; set; }
    public int Qty { get; set; }
    public string? StockRegister { get; set; }
    public string? AssetId { get; set; }
    public string Status { get; set; } // Available / Issued
    public string? CurrentlyIssuedTo { get; set; }
    public string? EmpNo { get; set; }
    public DateTime? IssuedDate { get; set; }
    public string? ReferenceFileNo { get; set; }
    public string? InventoryLocation { get; set; }
    public string? Specifications { get; set; }
    public string? Remarks { get; set; }
    public DateTime CreatedAt { get; set; } = DateTime.Now;
    public DateTime UpdatedAt { get; set; } = DateTime.Now;
}
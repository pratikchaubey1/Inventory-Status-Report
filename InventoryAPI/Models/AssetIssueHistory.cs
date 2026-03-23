using System;
using System.ComponentModel.DataAnnotations;
using System.ComponentModel.DataAnnotations.Schema;

namespace InventoryAPI.Models;

public class AssetIssueHistory
{
    [Key]
    public int Id { get; set; }

    public int InventoryId { get; set; }

    [ForeignKey("InventoryId")]
    public Inventory? Inventory { get; set; }

    public string? EmpNo { get; set; }

    public string? IssuedTo { get; set; }

    public DateTime? IssueDate { get; set; }

    public DateTime? SubmitDate { get; set; }

    public string? Status { get; set; }

    public string? ReferenceFileNo { get; set; }

    public string? Remarks { get; set; }
}

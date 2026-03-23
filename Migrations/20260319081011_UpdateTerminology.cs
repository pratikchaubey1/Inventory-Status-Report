using Microsoft.EntityFrameworkCore.Migrations;

#nullable disable

namespace inventory.Migrations
{
    /// <inheritdoc />
    public partial class UpdateTerminology : Migration
    {
        /// <inheritdoc />
        protected override void Up(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "StockRegisterPageNo",
                table: "Inventories",
                newName: "StockRegister");

            migrationBuilder.RenameColumn(
                name: "SerialNumber",
                table: "Inventories",
                newName: "MakeAndModel");

            migrationBuilder.RenameColumn(
                name: "EprObject",
                table: "Inventories",
                newName: "AssetId");
        }

        /// <inheritdoc />
        protected override void Down(MigrationBuilder migrationBuilder)
        {
            migrationBuilder.RenameColumn(
                name: "StockRegister",
                table: "Inventories",
                newName: "StockRegisterPageNo");

            migrationBuilder.RenameColumn(
                name: "MakeAndModel",
                table: "Inventories",
                newName: "SerialNumber");

            migrationBuilder.RenameColumn(
                name: "AssetId",
                table: "Inventories",
                newName: "EprObject");
        }
    }
}

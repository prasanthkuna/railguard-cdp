var builder = WebApplication.CreateBuilder(args);
var app = builder.Build();

app.MapGet("/health", () => Results.Ok(new { status = "ok", service = "railguard-gateway-dotnet", phase = "scaffold" }));

app.Run();

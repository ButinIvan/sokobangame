namespace Sokoban.Blazor.Game;

public sealed record LevelDefinition(int Id, string Name, IReadOnlyList<string> Map);

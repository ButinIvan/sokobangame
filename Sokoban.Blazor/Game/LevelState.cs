namespace Sokoban.Blazor.Game;

public sealed record LevelState(
    int Width,
    int Height,
    IReadOnlyCollection<GridPosition> Walls,
    IReadOnlyCollection<GridPosition> Floors,
    IReadOnlyCollection<GridPosition> Goals,
    IReadOnlyCollection<GridPosition> Boxes,
    GridPosition Player,
    bool IsRandom = false);

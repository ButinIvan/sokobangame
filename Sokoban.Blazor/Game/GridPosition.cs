namespace Sokoban.Blazor.Game;

public readonly record struct GridPosition(int X, int Y)
{
    public GridPosition Offset(int deltaX, int deltaY) => new(X + deltaX, Y + deltaY);
}

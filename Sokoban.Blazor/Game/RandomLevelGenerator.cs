namespace Sokoban.Blazor.Game;

public sealed class RandomLevelGenerator
{
    private static readonly (int X, int Y)[] Directions =
    [
        (0, -1),
        (0, 1),
        (-1, 0),
        (1, 0)
    ];

    public LevelState Generate()
    {
        LevelState generated = BuildState();

        for (var attempt = 0; attempt < 20; attempt++)
        {
            generated = BuildState();
            if (generated.Boxes.Any(box => !generated.Goals.Contains(box))) break;
        }

        return generated;
    }

    private static LevelState BuildState()
    {
        const int width = 8;
        const int height = 8;
        var walls = new HashSet<GridPosition>();
        var floors = new HashSet<GridPosition>();

        for (var y = 0; y < height; y++)
        {
            for (var x = 0; x < width; x++)
            {
                var position = new GridPosition(x, y);
                if (x == 0 || y == 0 || x == width - 1 || y == height - 1) walls.Add(position);
                else floors.Add(position);
            }
        }

        var goalCandidates = floors
            .Where(position => position.X >= 2 && position.X <= width - 3)
            .Where(position => position.Y >= 2 && position.Y <= height - 3)
            .OrderBy(_ => Random.Shared.Next())
            .Take(3)
            .ToArray();

        var goals = goalCandidates.ToHashSet();
        var boxes = goalCandidates.ToHashSet();
        var player = floors.Except(boxes).OrderBy(_ => Random.Shared.Next()).First();

        for (var pull = 0; pull < 45; pull++)
        {
            var reachable = FindReachable(player, boxes, floors);
            var options = new List<PullOption>();

            foreach (var box in boxes)
            {
                foreach (var (deltaX, deltaY) in Directions)
                {
                    var stance = box.Offset(-deltaX, -deltaY);
                    var destination = box.Offset(-2 * deltaX, -2 * deltaY);
                    if (reachable.Contains(stance) && floors.Contains(destination) && !boxes.Contains(destination))
                    {
                        options.Add(new PullOption(box, deltaX, deltaY));
                    }
                }
            }

            if (options.Count == 0) break;
            var selected = options[Random.Shared.Next(options.Count)];
            boxes.Remove(selected.Box);
            boxes.Add(selected.Box.Offset(-selected.DeltaX, -selected.DeltaY));
            player = selected.Box.Offset(-2 * selected.DeltaX, -2 * selected.DeltaY);
        }

        return new LevelState(width, height, walls, floors, goals, boxes, player, IsRandom: true);
    }

    private static HashSet<GridPosition> FindReachable(
        GridPosition start,
        HashSet<GridPosition> boxes,
        HashSet<GridPosition> floors)
    {
        var visited = new HashSet<GridPosition> { start };
        var queue = new Queue<GridPosition>();
        queue.Enqueue(start);

        while (queue.TryDequeue(out var current))
        {
            foreach (var (deltaX, deltaY) in Directions)
            {
                var next = current.Offset(deltaX, deltaY);
                if (floors.Contains(next) && !boxes.Contains(next) && visited.Add(next)) queue.Enqueue(next);
            }
        }

        return visited;
    }

    private sealed record PullOption(GridPosition Box, int DeltaX, int DeltaY);
}

namespace Sokoban.Blazor.Game;

public static class LevelParser
{
    public static LevelState Parse(LevelDefinition definition)
    {
        var rows = definition.Map;
        var width = rows.Max(row => row.Length);
        var walls = new HashSet<GridPosition>();
        var floors = new HashSet<GridPosition>();
        var goals = new HashSet<GridPosition>();
        var boxes = new HashSet<GridPosition>();
        var player = new GridPosition();

        for (var y = 0; y < rows.Count; y++)
        {
            var row = rows[y];
            var firstWall = row.IndexOf('#');
            var lastWall = row.LastIndexOf('#');

            for (var x = 0; x < width; x++)
            {
                var cell = x < row.Length ? row[x] : ' ';
                var position = new GridPosition(x, y);

                if (cell == '#')
                {
                    walls.Add(position);
                }

                if (".@$*+".Contains(cell) || cell == ' ' && x > firstWall && x < lastWall)
                {
                    floors.Add(position);
                }

                if (".*+".Contains(cell)) goals.Add(position);
                if ("$*".Contains(cell)) boxes.Add(position);
                if ("@+".Contains(cell)) player = position;
            }
        }

        return new LevelState(width, rows.Count, walls, floors, goals, boxes, player);
    }
}

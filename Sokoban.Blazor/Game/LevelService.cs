namespace Sokoban.Blazor.Game;

public sealed class LevelService(RandomLevelGenerator randomLevelGenerator)
{
    public IReadOnlyList<LevelDefinition> GetLevels() => LevelCatalog.Levels;

    public LevelState GetLevel(int id)
    {
        var definition = LevelCatalog.Levels.FirstOrDefault(level => level.Id == id)
            ?? throw new ArgumentOutOfRangeException(nameof(id), $"Уровень {id} не найден.");

        return LevelParser.Parse(definition);
    }

    public LevelState CreateRandomLevel() => randomLevelGenerator.Generate();
}

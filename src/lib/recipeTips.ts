export type RecipeProTip = {
  title: string;
  body: string;
};

const isProTipHeading = (line: string) =>
  /^(pro|key)\s*tip\b.*$/i.test(line.trim());

export function splitRecipeProTips(instructions: string | null | undefined) {
  const lines = (instructions ?? "").split(/\r?\n/);
  const instructionLines: string[] = [];
  const tips: RecipeProTip[] = [];

  for (let index = 0; index < lines.length; index += 1) {
    const line = lines[index];

    if (!isProTipHeading(line)) {
      instructionLines.push(line);
      continue;
    }

    const tipLines: string[] = [];

    while (index + 1 < lines.length) {
      const nextLine = lines[index + 1];
      const trimmed = nextLine.trim();

      if (isProTipHeading(nextLine)) break;

      index += 1;

      if (trimmed) {
        tipLines.push(trimmed);
      } else if (tipLines.length > 0) {
        break;
      }
    }

    if (tipLines.length > 0) {
      const [title, ...bodyLines] = tipLines;
      tips.push({
        title: title.replace(/:$/, ""),
        body: bodyLines.join(" ").trim(),
      });
    }
  }

  return {
    instructionsWithoutTips: instructionLines.join("\n").trim(),
    proTips: tips,
  };
}

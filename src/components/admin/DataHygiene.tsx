import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card } from "@/components/ui/card";
import { Progress } from "@/components/ui/progress";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type {
  AttributeIssue,
  CategorySuggestion,
  DuplicateGroup,
  QuestionScore,
} from "@/lib/admin/dataCleanup";
import {
  categorizeAllCharacters,
  findDuplicates,
  scoreQuestions,
  validateAllCharacters,
} from "@/lib/admin/dataCleanup";
import type { Character, Question } from "@/lib/types";
import { ArrowLeftIcon } from "@phosphor-icons/react";
import { useState } from "react";
import { toast } from "sonner";

interface DataHygieneProps {
  characters: Character[];
  questions: Question[];
  onUpdateCharacter: (character: Character) => void;
  onUpdateQuestion: (question: Question) => void;
  onBack: () => void;
}

export function DataHygiene({
  characters,
  questions,
  onUpdateCharacter,
  onUpdateQuestion,
  onBack,
}: Readonly<DataHygieneProps>) {

  // Attribute cleanup
  const [attrIssues, setAttrIssues] = useState<AttributeIssue[]>([]);
  const [attrHasRun, setAttrHasRun] = useState(false);
  const [attrProgress, setAttrProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [attrRunning, setAttrRunning] = useState(false);

  // Duplicates
  const [dupeGroups, setDupeGroups] = useState<DuplicateGroup[]>([]);
  const [dupeHasRun, setDupeHasRun] = useState(false);
  const [dupeProgress, setDupeProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [dupeRunning, setDupeRunning] = useState(false);

  // Question quality
  const [qScores, setQScores] = useState<QuestionScore[]>([]);
  const [qHasRun, setQHasRun] = useState(false);
  const [qProgress, setQProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [qRunning, setQRunning] = useState(false);

  const flaggedQuestionScores = qScores.filter(
    (score) =>
      score.rewrite
      || Math.min(score.scores.clarity, score.scores.power, score.scores.grammar) < 3,
  );

  // Categories
  const [catSuggestions, setCatSuggestions] = useState<CategorySuggestion[]>(
    [],
  );
  const [catHasRun, setCatHasRun] = useState(false);
  const [catProgress, setCatProgress] = useState<{
    done: number;
    total: number;
  } | null>(null);
  const [catRunning, setCatRunning] = useState(false);

  const runAttrCleanup = async () => {
    setAttrRunning(true);
    setAttrHasRun(false);
    setAttrIssues([]);
    try {
      const results = await validateAllCharacters(characters, (done, total) =>
        setAttrProgress({ done, total }),
      );
      setAttrIssues(results);
      setAttrHasRun(true);
    } catch {
      toast.error("Attribute scan failed");
    } finally {
      setAttrRunning(false);
      setAttrProgress(null);
    }
  };

  const runDupeCheck = async () => {
    setDupeRunning(true);
    setDupeHasRun(false);
    setDupeGroups([]);
    try {
      const results = await findDuplicates(characters, (done, total) =>
        setDupeProgress({ done, total }),
      );
      setDupeGroups(results);
      setDupeHasRun(true);
    } catch {
      toast.error("Duplicate check failed");
    } finally {
      setDupeRunning(false);
      setDupeProgress(null);
    }
  };

  const runQScoring = async () => {
    setQRunning(true);
    setQHasRun(false);
    setQScores([]);
    try {
      const results = await scoreQuestions(questions, (done, total) =>
        setQProgress({ done, total }),
      );
      setQScores(results);
      setQHasRun(true);
    } catch {
      toast.error("Question scoring failed");
    } finally {
      setQRunning(false);
      setQProgress(null);
    }
  };

  const runCategorization = async () => {
    setCatRunning(true);
    setCatHasRun(false);
    setCatSuggestions([]);
    try {
      const results = await categorizeAllCharacters(characters, (done, total) =>
        setCatProgress({ done, total }),
      );
      setCatSuggestions(results);
      setCatHasRun(true);
    } catch {
      toast.error("Categorization failed");
    } finally {
      setCatRunning(false);
      setCatProgress(null);
    }
  };

  const applyAttrFix = (issue: AttributeIssue) => {
    const char = characters.find((c) => c.id === issue.characterId);
    if (!char) return;
    onUpdateCharacter({
      ...char,
      attributes: {
        ...char.attributes,
        [issue.attribute]: issue.suggestedValue,
      },
    });
    setAttrIssues((prev) => prev.filter((i) => i !== issue));
  };

  const applyQuestionRewrite = (score: QuestionScore) => {
    if (!score.rewrite) return;
    const q = questions.find((q) => q.id === score.questionId);
    if (!q) return;
    onUpdateQuestion({ ...q, text: score.rewrite });
    setQScores((prev) => prev.filter((s) => s !== score));
  };

  const applyCategorySuggestion = (suggestion: CategorySuggestion) => {
    const char = characters.find((c) => c.id === suggestion.characterId);
    if (!char) return;
    onUpdateCharacter({ ...char, category: suggestion.suggestedCategory });
    setCatSuggestions((prev) => prev.filter((s) => s !== suggestion));
  };

  return (
    <div className="space-y-6">
      <div className="flex items-center justify-between">
        <div>
          <h2 className="text-3xl font-bold text-foreground">Data Hygiene</h2>
          <p className="text-muted-foreground mt-1">
            AI-powered database cleanup and validation
          </p>
        </div>
        <Button onClick={onBack} variant="outline" className="gap-2">
          <ArrowLeftIcon size={18} />
          Back
        </Button>
      </div>

      <Tabs defaultValue="attributes">
        <TabsList className="grid w-full grid-cols-2 sm:grid-cols-4">
          <TabsTrigger value="attributes" className="text-xs sm:text-sm">
            Attributes{" "}
            {attrIssues.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {attrIssues.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="duplicates" className="text-xs sm:text-sm">
            Duplicates{" "}
            {dupeGroups.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {dupeGroups.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="questions" className="text-xs sm:text-sm">
            Questions{" "}
            {flaggedQuestionScores.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {flaggedQuestionScores.length}
              </Badge>
            )}
          </TabsTrigger>
          <TabsTrigger value="categories" className="text-xs sm:text-sm">
            Categories{" "}
            {catSuggestions.length > 0 && (
              <Badge variant="destructive" className="ml-1">
                {catSuggestions.length}
              </Badge>
            )}
          </TabsTrigger>
        </TabsList>

        <TabsContent value="attributes" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {characters.length} characters to scan
            </p>
            <Button onClick={runAttrCleanup} disabled={attrRunning} size="sm">
              {attrRunning ? "Scanning..." : "Run Analysis"}
            </Button>
          </div>
          {attrProgress && (
            <Progress
              value={(attrProgress.done / attrProgress.total) * 100}
              className="h-2"
            />
          )}
          {!attrRunning && attrHasRun && attrIssues.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Analysis complete. No attribute issues found.
            </p>
          )}
          {attrIssues.map((issue, i) => (
            <Card
              key={`${issue.characterId}-${issue.attribute}-${i}`}
              className="p-4"
            >
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    {issue.characterName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    <code className="text-xs">{issue.attribute}</code>:{" "}
                    {String(issue.currentValue)} →{" "}
                    {String(issue.suggestedValue)}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {issue.reason}
                  </p>
                </div>
                <Button
                  onClick={() => applyAttrFix(issue)}
                  size="sm"
                  variant="outline"
                >
                  Apply
                </Button>
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="duplicates" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {characters.length} characters to check
            </p>
            <Button onClick={runDupeCheck} disabled={dupeRunning} size="sm">
              {dupeRunning ? "Checking..." : "Run Analysis"}
            </Button>
          </div>
          {dupeProgress && (
            <Progress
              value={(dupeProgress.done / dupeProgress.total) * 100}
              className="h-2"
            />
          )}
          {!dupeRunning && dupeHasRun && dupeGroups.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Analysis complete. No duplicate candidates found.
            </p>
          )}
          {dupeGroups.map((group) => (
            <Card
              key={`${group.canonical.id}-${group.duplicates.map((duplicate) => duplicate.id).join("-")}`}
              className="p-4"
            >
              <p className="font-medium text-foreground">
                Keep: {group.canonical.name}
              </p>
              <p className="text-sm text-muted-foreground">
                Duplicates: {group.duplicates.map((d) => d.name).join(", ")}
              </p>
              <Badge variant="secondary" className="mt-1">
                {Math.round(group.confidence * 100)}% confident
              </Badge>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="questions" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {questions.length} questions to score
            </p>
            <Button onClick={runQScoring} disabled={qRunning} size="sm">
              {qRunning ? "Scoring..." : "Run Analysis"}
            </Button>
          </div>
          {qProgress && (
            <Progress
              value={(qProgress.done / qProgress.total) * 100}
              className="h-2"
            />
          )}
          {!qRunning && qHasRun && flaggedQuestionScores.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Analysis complete. No question rewrites or low-quality prompts
              were flagged.
            </p>
          )}
          {flaggedQuestionScores.map((score) => (
            <Card key={score.questionId} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    {score.questionText}
                  </p>
                  <div className="flex gap-2 mt-1">
                    <Badge
                      variant={
                        score.scores.clarity < 3 ? "destructive" : "secondary"
                      }
                    >
                      Clarity: {score.scores.clarity}
                    </Badge>
                    <Badge
                      variant={
                        score.scores.power < 3 ? "destructive" : "secondary"
                      }
                    >
                      Power: {score.scores.power}
                    </Badge>
                    <Badge
                      variant={
                        score.scores.grammar < 3 ? "destructive" : "secondary"
                      }
                    >
                      Grammar: {score.scores.grammar}
                    </Badge>
                  </div>
                  {score.rewrite && (
                    <p className="text-sm text-accent mt-1">
                      Suggested: {score.rewrite}
                    </p>
                  )}
                </div>
                {score.rewrite && (
                  <Button
                    onClick={() => applyQuestionRewrite(score)}
                    size="sm"
                    variant="outline"
                  >
                    Apply
                  </Button>
                )}
              </div>
            </Card>
          ))}
        </TabsContent>

        <TabsContent value="categories" className="space-y-4">
          <div className="flex items-center justify-between">
            <p className="text-sm text-muted-foreground">
              {characters.length} characters to check
            </p>
            <Button onClick={runCategorization} disabled={catRunning} size="sm">
              {catRunning ? "Categorizing..." : "Run Analysis"}
            </Button>
          </div>
          {catProgress && (
            <Progress
              value={(catProgress.done / catProgress.total) * 100}
              className="h-2"
            />
          )}
          {!catRunning && catHasRun && catSuggestions.length === 0 && (
            <p className="text-sm text-muted-foreground">
              Analysis complete. No category changes were suggested.
            </p>
          )}
          {catSuggestions.map((suggestion) => (
            <Card key={suggestion.characterId} className="p-4">
              <div className="flex items-center justify-between">
                <div>
                  <p className="font-medium text-foreground">
                    {suggestion.characterName}
                  </p>
                  <p className="text-sm text-muted-foreground">
                    {suggestion.currentCategory} →{" "}
                    {suggestion.suggestedCategory}
                  </p>
                  <p className="text-xs text-muted-foreground mt-1">
                    {suggestion.reasoning}
                  </p>
                </div>
                <Button
                  onClick={() => applyCategorySuggestion(suggestion)}
                  size="sm"
                  variant="outline"
                >
                  Apply
                </Button>
              </div>
            </Card>
          ))}
        </TabsContent>
      </Tabs>
    </div>
  );
}

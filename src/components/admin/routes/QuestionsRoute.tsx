import { Fragment } from "react";
import { AdminPageHeader } from "../AdminPageHeader";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Badge } from "@/components/ui/badge";
import {
  MagnifyingGlassIcon,
  PencilSimpleIcon,
  CheckIcon,
  XIcon,
  ToggleLeftIcon,
  ToggleRightIcon,
  ArrowLeftIcon,
  ArrowRightIcon,
  SparkleIcon,
} from "@phosphor-icons/react";
import {
  SKELETON_ROW_KEYS,
  parseDifficultySelection,
  scoreButtonClass,
} from "./questions/questionsHelpers";
import { DifficultyBadge } from "./questions/DifficultyBadge";
import { ScoreBar } from "./questions/ScoreBar";
import { useQuestionsListing } from "./questions/useQuestionsListing";
import { useQuestionInlineEdits } from "./questions/useQuestionInlineEdits";
import { useQuestionScoring } from "./questions/useQuestionScoring";
import { useQuestionExpansion } from "./questions/useQuestionExpansion";
import { useQuestionBulkActions } from "./questions/useQuestionBulkActions";
import { QuestionsToolbar } from "./questions/QuestionsToolbar";
import { BulkActionsBar } from "./questions/BulkActionsBar";
import { RewriteCandidatesPanel } from "./questions/RewriteCandidatesPanel";
import { ExpansionRunHistory } from "./questions/ExpansionRunHistory";

export default function QuestionsRoute(): React.JSX.Element {
  const listing = useQuestionsListing();
  const {
    data,
    setData,
    loading,
    error,
    setError,
    search,
    setSearch,
    activeFilter,
    setActiveFilter,
    difficultyFilter,
    setDifficultyFilter,
    textStatusFilter,
    setTextStatusFilter,
    sort,
    setSort,
    order,
    setOrder,
    minUsage,
    setMinUsage,
    page,
    setPage,
    totalPages,
    selectedKeys,
    toggleSelect,
    toggleSelectAll,
    refetch,
    clearFilters,
    applyQuickPreset,
  } = listing;

  const inlineEdits = useQuestionInlineEdits({ setData });
  const {
    editingKey,
    editValue,
    setEditValue,
    editRef,
    saving,
    difficultySavingKeys,
    startEdit,
    cancelEdit,
    saveEdit,
    toggleActive,
    updateDifficultyInline,
  } = inlineEdits;

  const scoring = useQuestionScoring({ data, setData, setError, selectedKeys });
  const {
    scores,
    scoringKey,
    rewriteQueue,
    bulkScoring,
    bulkScoreProgress,
    scoreQuestion,
    scoreSelectedQuestions,
    applyRewriteCandidate,
    applyAllRewrites,
  } = scoring;

  const expansion = useQuestionExpansion({ refetchListing: refetch, setError });
  const {
    expanding,
    expansionMessage,
    runStatusFilter,
    setRunStatusFilter,
    runModeFilter,
    setRunModeFilter,
    visibleExpansionRuns,
    fetchExpansionHistory,
    expandQuestions,
  } = expansion;

  const bulkActions = useQuestionBulkActions({
    selectedKeys,
    refetchListing: refetch,
  });
  const {
    bulkUpdating,
    bulkDifficulty,
    setBulkDifficulty,
    runBulkUpdate,
    applyBulkDifficulty,
  } = bulkActions;

  return (
    <div className="container mx-auto px-4 pb-8 max-w-5xl space-y-6">
      <AdminPageHeader
        title="Question Manager"
        subtitle={data ? `${data.total} attribute definitions` : undefined}
        sectionColor="blue"
        actions={
          <div className="flex items-center gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => void expandQuestions(true)}
              disabled={expanding}
            >
              <SparkleIcon size={14} className="mr-1" />
              {expanding ? "Running…" : "Preview Expansion"}
            </Button>
            <Button
              size="sm"
              onClick={() => void expandQuestions(false)}
              disabled={expanding}
            >
              <SparkleIcon size={14} className="mr-1" />
              {expanding ? "Running…" : "Apply Expansion"}
            </Button>
            <div className="relative w-72">
              <MagnifyingGlassIcon
                className="absolute left-3 top-1/2 -translate-y-1/2 text-muted-foreground"
                size={16}
              />
              <Input
                placeholder="Search questions…"
                value={search}
                onChange={(e) => setSearch(e.target.value)}
                className="pl-9"
              />
            </div>
          </div>
        }
      />

      {error && (
        <div className="rounded-lg bg-destructive/10 border border-destructive/30 px-4 py-3 text-sm text-destructive">
          {error}
        </div>
      )}

      {expansionMessage && (
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-4 py-3 text-sm text-emerald-600">
          {expansionMessage}
        </div>
      )}

      <QuestionsToolbar
        activeFilter={activeFilter}
        setActiveFilter={setActiveFilter}
        difficultyFilter={difficultyFilter}
        setDifficultyFilter={setDifficultyFilter}
        textStatusFilter={textStatusFilter}
        setTextStatusFilter={setTextStatusFilter}
        minUsage={minUsage}
        setMinUsage={setMinUsage}
        sort={sort}
        setSort={setSort}
        order={order}
        toggleOrder={() => setOrder((prev) => (prev === "desc" ? "asc" : "desc"))}
        clearFilters={clearFilters}
        applyQuickPreset={applyQuickPreset}
      />

      <BulkActionsBar
        selectedCount={selectedKeys.size}
        bulkScoring={bulkScoring}
        bulkScoreProgress={bulkScoreProgress}
        bulkUpdating={bulkUpdating}
        bulkDifficulty={bulkDifficulty}
        setBulkDifficulty={setBulkDifficulty}
        scoreSelectedQuestions={() => void scoreSelectedQuestions()}
        runBulkUpdate={(payload) => void runBulkUpdate(payload)}
        applyBulkDifficulty={() => void applyBulkDifficulty()}
      />

      <RewriteCandidatesPanel
        rewriteQueue={rewriteQueue}
        applyRewriteCandidate={(c) => void applyRewriteCandidate(c)}
        applyAllRewrites={() => void applyAllRewrites()}
      />

      <ExpansionRunHistory
        visibleExpansionRuns={visibleExpansionRuns}
        runStatusFilter={runStatusFilter}
        setRunStatusFilter={setRunStatusFilter}
        runModeFilter={runModeFilter}
        setRunModeFilter={setRunModeFilter}
        expanding={expanding}
        fetchExpansionHistory={() => void fetchExpansionHistory()}
      />

      <div className="rounded-xl border bg-card overflow-hidden">
        <table className="w-full text-sm">
          <thead className="bg-muted/50">
            <tr>
              <th className="px-4 py-3 w-8">
                <input
                  type="checkbox"
                  checked={
                    (data?.questions ?? []).length > 0 &&
                    selectedKeys.size === (data?.questions ?? []).length
                  }
                  onChange={toggleSelectAll}
                  className="cursor-pointer"
                  aria-label="Select all questions"
                />
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground w-40">
                Key
              </th>
              <th className="text-left px-4 py-3 font-medium text-muted-foreground">
                Question text
              </th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground w-24">
                Difficulty
              </th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground w-20">
                Uses
              </th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground w-20">
                Active
              </th>
              <th className="text-center px-4 py-3 font-medium text-muted-foreground w-28">
                Actions
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {loading && !data
              ? SKELETON_ROW_KEYS.map((rowKey) => (
                  <tr key={rowKey}>
                    <td colSpan={7} className="px-4 py-3">
                      <div className="h-4 bg-muted animate-pulse rounded" />
                    </td>
                  </tr>
                ))
              : (data?.questions ?? []).map((q) => {
                  const rowVisibilityClass = q.isActive ? "" : "opacity-50";
                  const scoreBtnClass = scoreButtonClass(
                    scoringKey,
                    scores,
                    q.key,
                  );

                  return (
                    <Fragment key={`${q.key}-row-wrapper`}>
                      <tr
                        key={q.key}
                        className={`hover:bg-muted/30 transition-colors ${rowVisibilityClass}`}
                      >
                        <td className="px-4 py-3">
                          <input
                            type="checkbox"
                            checked={selectedKeys.has(q.key)}
                            onChange={() => toggleSelect(q.key)}
                            className="cursor-pointer"
                            aria-label={`Select ${q.key}`}
                          />
                        </td>
                        <td className="px-4 py-3 font-mono text-xs text-muted-foreground">
                          {q.key}
                        </td>
                        <td className="px-4 py-3">
                          {editingKey === q.key ? (
                            <div className="flex items-center gap-2">
                              <Input
                                ref={editRef}
                                value={editValue}
                                onChange={(e) => setEditValue(e.target.value)}
                                onKeyDown={(e) => {
                                  if (e.key === "Enter") void saveEdit(q.key);
                                  if (e.key === "Escape") cancelEdit();
                                }}
                                className="h-7 text-sm"
                              />
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-green-500"
                                onClick={() => void saveEdit(q.key)}
                                disabled={saving}
                              >
                                <CheckIcon size={14} />
                              </Button>
                              <Button
                                size="icon"
                                variant="ghost"
                                className="h-7 w-7 text-muted-foreground"
                                onClick={cancelEdit}
                              >
                                <XIcon size={14} />
                              </Button>
                            </div>
                          ) : (
                            <span>
                              {q.questionText ?? (
                                <span className="text-muted-foreground italic">
                                  No question text
                                </span>
                              )}
                            </span>
                          )}
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-2">
                            <select
                              value={q.difficulty ?? "unset"}
                              onChange={(event) => {
                                const difficultyValue =
                                  parseDifficultySelection(event.target.value);
                                void updateDifficultyInline(q, difficultyValue);
                              }}
                              disabled={difficultySavingKeys.has(q.key)}
                              className="h-7 rounded-md border border-border bg-background px-2 text-xs"
                              aria-label={`Difficulty for ${q.key}`}
                            >
                              <option value="unset">Unset</option>
                              <option value="easy">Easy</option>
                              <option value="medium">Medium</option>
                              <option value="hard">Hard</option>
                            </select>
                            <DifficultyBadge difficulty={q.difficulty} />
                          </div>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <Badge variant="secondary" className="text-xs">
                            {q.usageCount}
                          </Badge>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <button
                            onClick={() => void toggleActive(q)}
                            className="text-muted-foreground hover:text-foreground transition-colors"
                            aria-label={q.isActive ? "Disable" : "Enable"}
                          >
                            {q.isActive ? (
                              <ToggleRightIcon
                                size={24}
                                className="text-green-500"
                              />
                            ) : (
                              <ToggleLeftIcon size={24} />
                            )}
                          </button>
                        </td>
                        <td className="px-4 py-3 text-center">
                          <div className="flex items-center justify-center gap-1">
                            <Button
                              size="icon"
                              variant="ghost"
                              className="h-7 w-7"
                              onClick={() => startEdit(q)}
                              title="Edit question text"
                            >
                              <PencilSimpleIcon size={14} />
                            </Button>
                            <Button
                              size="icon"
                              variant="ghost"
                              className={`h-7 w-7 ${scoreBtnClass}`}
                              onClick={() => void scoreQuestion(q)}
                              disabled={scoringKey === q.key}
                              title="AI quality score"
                            >
                              <SparkleIcon size={14} />
                            </Button>
                          </div>
                        </td>
                      </tr>
                      {scores[q.key] && (
                        <tr key={`${q.key}-score`} className="bg-violet-500/5">
                          <td colSpan={7} className="px-4 py-2">
                            <div className="flex flex-col gap-1 max-w-xs">
                              <ScoreBar
                                label="Clarity"
                                value={scores[q.key].clarity}
                              />
                              <ScoreBar
                                label="Power"
                                value={scores[q.key].power}
                              />
                              <ScoreBar
                                label="Grammar"
                                value={scores[q.key].grammar}
                              />
                              {scores[q.key].rewrite && (
                                <p className="text-xs text-violet-400 mt-1 italic">
                                  Rewrite suggestion added to ranked queue
                                </p>
                              )}
                            </div>
                          </td>
                        </tr>
                      )}
                    </Fragment>
                  );
                })}
          </tbody>
        </table>
      </div>

      {totalPages > 1 && (
        <div className="flex items-center justify-between">
          <p className="text-sm text-muted-foreground">
            Page {page} of {totalPages}
          </p>
          <div className="flex gap-2">
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p - 1)}
              disabled={page <= 1 || loading}
            >
              <ArrowLeftIcon size={14} className="mr-1" /> Prev
            </Button>
            <Button
              variant="outline"
              size="sm"
              onClick={() => setPage((p) => p + 1)}
              disabled={page >= totalPages || loading}
            >
              Next <ArrowRightIcon size={14} className="ml-1" />
            </Button>
          </div>
        </div>
      )}
    </div>
  );
}

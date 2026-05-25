import { useCallback, useEffect, useRef, useState } from "react";

import { ADMIN_API_ENDPOINTS } from "@/lib/constants";

import type {
  ActiveFilter,
  AdminQuestion,
  DifficultyFilter,
  PageData,
  QuestionSort,
  QuickPreset,
  SortOrder,
  TextStatusFilter,
} from "./questionsTypes";
import {
  buildQuestionsListParams,
  defaultFilterState,
  quickPresetFilters,
} from "./questionsHelpers";

const PAGE_SIZE = 50;

export interface UseQuestionsListingResult {
  data: PageData | null;
  setData: React.Dispatch<React.SetStateAction<PageData | null>>;
  loading: boolean;
  error: string | null;
  setError: React.Dispatch<React.SetStateAction<string | null>>;

  search: string;
  setSearch: React.Dispatch<React.SetStateAction<string>>;
  activeFilter: ActiveFilter;
  setActiveFilter: React.Dispatch<React.SetStateAction<ActiveFilter>>;
  difficultyFilter: DifficultyFilter;
  setDifficultyFilter: React.Dispatch<React.SetStateAction<DifficultyFilter>>;
  textStatusFilter: TextStatusFilter;
  setTextStatusFilter: React.Dispatch<React.SetStateAction<TextStatusFilter>>;
  sort: QuestionSort;
  setSort: React.Dispatch<React.SetStateAction<QuestionSort>>;
  order: SortOrder;
  setOrder: React.Dispatch<React.SetStateAction<SortOrder>>;
  minUsage: string;
  setMinUsage: (value: string) => void;
  page: number;
  setPage: React.Dispatch<React.SetStateAction<number>>;
  pageSize: number;
  totalPages: number;

  selectedKeys: Set<string>;
  setSelectedKeys: React.Dispatch<React.SetStateAction<Set<string>>>;
  toggleSelect: (key: string) => void;
  toggleSelectAll: () => void;

  fetchData: (searchVal: string, pageVal: number) => Promise<void>;
  refetch: () => Promise<void>;

  clearFilters: () => void;
  applyQuickPreset: (preset: QuickPreset) => void;
}

export function useQuestionsListing(): UseQuestionsListingResult {
  const [data, setData] = useState<PageData | null>(null);
  const [loading, setLoading] = useState(true);
  const [error, setError] = useState<string | null>(null);

  const [search, setSearch] = useState("");
  const [activeFilter, setActiveFilter] = useState<ActiveFilter>("all");
  const [difficultyFilter, setDifficultyFilter] =
    useState<DifficultyFilter>("all");
  const [textStatusFilter, setTextStatusFilter] =
    useState<TextStatusFilter>("all");
  const [sort, setSort] = useState<QuestionSort>("usage");
  const [order, setOrder] = useState<SortOrder>("desc");
  const [minUsage, setMinUsageState] = useState("");
  const [page, setPage] = useState(1);

  const [selectedKeys, setSelectedKeys] = useState<Set<string>>(new Set());

  const latestSearchRef = useRef(search);
  const previousPageRef = useRef(page);

  const fetchData = useCallback(
    async (searchVal: string, pageVal: number) => {
      setLoading(true);
      setError(null);
      try {
        const params = buildQuestionsListParams({
          search: searchVal,
          activeFilter,
          difficultyFilter,
          textStatusFilter,
          sort,
          order,
          minUsage,
          page: pageVal,
          pageSize: PAGE_SIZE,
        });
        const res = await fetch(`${ADMIN_API_ENDPOINTS.questions}?${params}`);
        if (!res.ok) throw new Error(`${res.status} ${res.statusText}`);
        setData(await res.json());
        setSelectedKeys(new Set());
      } catch (e) {
        setError(e instanceof Error ? e.message : "Unknown error");
      } finally {
        setLoading(false);
      }
    },
    [activeFilter, difficultyFilter, minUsage, order, sort, textStatusFilter],
  );

  useEffect(() => {
    latestSearchRef.current = search;
  }, [search]);

  useEffect(() => {
    const timer = setTimeout(() => {
      previousPageRef.current = 1;
      setPage(1);
      void fetchData(search, 1);
    }, 300);
    return () => clearTimeout(timer);
  }, [
    search,
    activeFilter,
    difficultyFilter,
    textStatusFilter,
    sort,
    order,
    minUsage,
    fetchData,
  ]);

  useEffect(() => {
    if (previousPageRef.current === page) {
      return;
    }
    previousPageRef.current = page;
    void fetchData(latestSearchRef.current, page);
  }, [fetchData, page]);

  const refetch = useCallback(
    () => fetchData(latestSearchRef.current, page),
    [fetchData, page],
  );

  const toggleSelect = useCallback((key: string) => {
    setSelectedKeys((prev) => {
      const next = new Set(prev);
      if (next.has(key)) next.delete(key);
      else next.add(key);
      return next;
    });
  }, []);

  const toggleSelectAll = useCallback(() => {
    const all = (data?.questions ?? []).map((q: AdminQuestion) => q.key);
    setSelectedKeys((prev) =>
      prev.size === all.length ? new Set() : new Set(all),
    );
  }, [data]);

  const clearFilters = useCallback(() => {
    const d = defaultFilterState();
    setSearch("");
    setActiveFilter(d.activeFilter);
    setDifficultyFilter(d.difficultyFilter);
    setTextStatusFilter(d.textStatusFilter);
    setSort(d.sort);
    setOrder(d.order);
    setMinUsageState(d.minUsage);
    setPage(1);
  }, []);

  const applyQuickPreset = useCallback((preset: QuickPreset) => {
    const s = quickPresetFilters(preset);
    setActiveFilter(s.activeFilter);
    setDifficultyFilter(s.difficultyFilter);
    setTextStatusFilter(s.textStatusFilter);
    setSort(s.sort);
    setOrder(s.order);
    setMinUsageState(s.minUsage);
    setPage(1);
  }, []);

  const setMinUsage = useCallback((value: string) => {
    setMinUsageState(value);
  }, []);

  const totalPages = data ? Math.ceil(data.total / PAGE_SIZE) : 1;

  return {
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
    pageSize: PAGE_SIZE,
    totalPages,
    selectedKeys,
    setSelectedKeys,
    toggleSelect,
    toggleSelectAll,
    fetchData,
    refetch,
    clearFilters,
    applyQuickPreset,
  };
}

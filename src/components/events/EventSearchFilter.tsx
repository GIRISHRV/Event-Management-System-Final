"use client";

import { useState, useMemo, useCallback } from "react";
import { Search, MapPin, Calendar, X, Filter } from "lucide-react";

interface EventSearchFilterProps {
  onSearchChange: (search: string) => void;
  onLocationChange: (location: string) => void;
  onDateChange: (date: string) => void;
  onCategoryChange?: (category: string) => void;
  locations: string[];
  categories?: string[];
  showCategory?: boolean;
}

export function EventSearchFilter({
  onSearchChange,
  onLocationChange,
  onDateChange,
  onCategoryChange,
  locations,
  categories = [],
  showCategory = false,
}: EventSearchFilterProps) {
  const [search, setSearch] = useState("");
  const [location, setLocation] = useState("all");
  const [date, setDate] = useState("all");
  const [category, setCategory] = useState("all");
  const [showFilters, setShowFilters] = useState(false);

  const handleSearchChange = useCallback(
    (value: string) => {
      setSearch(value);
      onSearchChange(value);
    },
    [onSearchChange]
  );

  const handleLocationChange = useCallback(
    (value: string) => {
      setLocation(value);
      onLocationChange(value);
    },
    [onLocationChange]
  );

  const handleDateChange = useCallback(
    (value: string) => {
      setDate(value);
      onDateChange(value);
    },
    [onDateChange]
  );

  const handleCategoryChange = useCallback(
    (value: string) => {
      setCategory(value);
      onCategoryChange?.(value);
    },
    [onCategoryChange]
  );

  const clearFilters = useCallback(() => {
    setSearch("");
    setLocation("all");
    setDate("all");
    setCategory("all");
    onSearchChange("");
    onLocationChange("all");
    onDateChange("all");
    onCategoryChange?.("all");
  }, [onSearchChange, onLocationChange, onDateChange, onCategoryChange]);

  const hasActiveFilters = useMemo(
    () => search || location !== "all" || date !== "all" || category !== "all",
    [search, location, date, category]
  );

  return (
    <div className="space-y-4 mb-6">
      {/* Search Bar with Filter Toggle */}
      <div className="flex gap-2">
        <div className="relative flex-1">
          <Search
            size={18}
            className="absolute left-3 top-1/2 -translate-y-1/2 text-zinc-500"
          />
          <input
            type="text"
            placeholder="Search events by name or description..."
            value={search}
            onChange={(e) => handleSearchChange(e.target.value)}
            className="w-full pl-10 pr-4 py-2.5 bg-zinc-800/60 border border-zinc-700/50 rounded-xl text-white placeholder-zinc-500 focus:outline-none focus:border-primary transition backdrop-blur-md"
          />
          {search && (
            <button
              onClick={() => handleSearchChange("")}
              className="absolute right-3 top-1/2 -translate-y-1/2 text-zinc-500 hover:text-white transition"
            >
              <X size={16} />
            </button>
          )}
        </div>
        <button
          onClick={() => setShowFilters(!showFilters)}
          className={`px-4 py-2.5 rounded-xl border transition flex items-center gap-2 ${
            showFilters || hasActiveFilters
              ? "bg-primary/20 border-primary/50 text-primary"
              : "bg-zinc-800/60 border-zinc-700/50 text-zinc-400 hover:text-white"
          }`}
        >
          <Filter size={18} />
          <span className="hidden sm:inline">Filters</span>
          {hasActiveFilters && (
            <span className="w-2 h-2 rounded-full bg-primary" />
          )}
        </button>
      </div>

      {/* Filter Row */}
      {showFilters && (
        <div className="flex gap-3 flex-wrap items-center p-4 bg-zinc-800/40 rounded-xl border border-zinc-700/30 animate-in slide-in-from-top-2 duration-200">
          {/* Location Filter */}
          <div className="flex items-center gap-2">
            <MapPin size={16} className="text-zinc-500" />
            <select
              value={location}
              onChange={(e) => handleLocationChange(e.target.value)}
              className="px-3 py-2 bg-zinc-800 border border-zinc-700/50 rounded-lg text-white focus:outline-none focus:border-primary transition text-sm min-w-[140px]"
            >
              <option value="all">All Locations</option>
              {locations.map((loc) => (
                <option key={loc} value={loc}>
                  {loc}
                </option>
              ))}
            </select>
          </div>

          {/* Date Filter */}
          <div className="flex items-center gap-2">
            <Calendar size={16} className="text-zinc-500" />
            <select
              value={date}
              onChange={(e) => handleDateChange(e.target.value)}
              className="px-3 py-2 bg-zinc-800 border border-zinc-700/50 rounded-lg text-white focus:outline-none focus:border-primary transition text-sm min-w-[140px]"
            >
              <option value="all">All Dates</option>
              <option value="upcoming">Upcoming</option>
              <option value="this-week">This Week</option>
              <option value="this-month">This Month</option>
              <option value="past">Past Events</option>
            </select>
          </div>

          {/* Category Filter */}
          {showCategory && categories.length > 0 && (
            <select
              value={category}
              onChange={(e) => handleCategoryChange(e.target.value)}
              className="px-3 py-2 bg-zinc-800 border border-zinc-700/50 rounded-lg text-white focus:outline-none focus:border-primary transition text-sm min-w-[140px]"
            >
              <option value="all">All Categories</option>
              {categories.map((cat) => (
                <option key={cat} value={cat}>
                  {cat}
                </option>
              ))}
            </select>
          )}

          {/* Clear Filters */}
          {hasActiveFilters && (
            <button
              onClick={clearFilters}
              className="px-3 py-2 text-sm text-zinc-400 hover:text-white transition flex items-center gap-1"
            >
              <X size={14} />
              Clear all
            </button>
          )}
        </div>
      )}
    </div>
  );
}

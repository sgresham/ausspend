import { useId, useMemo, useState } from 'react';
import {
  Box,
  CircularProgress,
  Divider,
  IconButton,
  InputAdornment,
  ListItemButton,
  ListItemText,
  Paper,
  TextField,
  Typography,
} from '@mui/material';
import SearchIcon from '@mui/icons-material/Search';
import { Link as RouterLink, useNavigate } from 'react-router-dom';
import type { RegionRef } from '../api/types';
import { groupDiscoveryResults, type DiscoveryItem, type DiscoveryKind } from '../search/discovery';
import { useDiscovery } from '../search/DiscoveryProvider';

interface QuickSearchProps {
  label?: string;
  autoFocus?: boolean;
  /** `header` renders a compact field with an absolutely positioned panel. */
  variant?: 'default' | 'hero' | 'header';
  /** Stable test id for the root; option test ids stay kind-specific. */
  testId?: string;
  /** When provided, picking a function runs this instead of navigating. */
  onPickFunction?: (code: string) => void;
  onPickRegion?: (region: RegionRef) => void;
}

const OPTION_TEST_IDS: Record<DiscoveryKind, string> = {
  function: 'quick-function-result',
  region: 'quick-region-result',
  data_source: 'quick-source-result',
  soc: 'quick-soc-result',
};

const DEFAULT_LABEL = 'Search functions, regions, sources and State-owned entities';

export function QuickSearch({
  label = DEFAULT_LABEL,
  autoFocus = false,
  variant = 'default',
  testId = 'quick-search',
  onPickFunction,
  onPickRegion,
}: QuickSearchProps) {
  const navigate = useNavigate();
  const discovery = useDiscovery();
  const [query, setQuery] = useState('');
  const [open, setOpen] = useState(false);
  const [activeIndex, setActiveIndex] = useState(-1);
  const listboxId = useId();
  const helperId = useId();

  const trimmed = query.trim();
  const searchResults = useMemo(() => discovery.search(trimmed), [discovery, trimmed]);
  const groups = useMemo(() => groupDiscoveryResults(searchResults), [searchResults]);
  const orderedResults = useMemo(() => groups.flatMap((group) => group.items), [groups]);
  const suggestion = useMemo(
    () => (searchResults.length === 0 ? discovery.suggest(trimmed) : null),
    [discovery, searchResults.length, trimmed],
  );
  const showResults = open && trimmed.length >= 2;
  const noResults = showResults && !discovery.loading && searchResults.length === 0;
  const activeItem = activeIndex >= 0 ? orderedResults[activeIndex] : undefined;
  const optionId = (index: number) => `${listboxId}-option-${index}`;

  const close = () => {
    setOpen(false);
    setActiveIndex(-1);
  };

  const selectItem = (item: DiscoveryItem) => {
    if (item.kind === 'function' && item.functionCode && onPickFunction) {
      onPickFunction(item.functionCode);
      close();
      return;
    }
    if (item.kind === 'region' && item.region && onPickRegion) {
      onPickRegion(item.region);
      close();
      return;
    }
    close();
    navigate(item.href);
  };

  const submit = () => {
    if (!trimmed) return;
    close();
    navigate(`/search?q=${encodeURIComponent(trimmed)}`);
  };

  const handleKeyDown = (event: React.KeyboardEvent<HTMLInputElement>) => {
    if (event.key === 'ArrowDown') {
      event.preventDefault();
      if (!showResults && trimmed.length >= 2) {
        setOpen(true);
        setActiveIndex(0);
        return;
      }
      if (orderedResults.length === 0) return;
      setActiveIndex((index) => (index + 1) % orderedResults.length);
      return;
    }
    if (event.key === 'ArrowUp') {
      event.preventDefault();
      if (!showResults && trimmed.length >= 2) {
        setOpen(true);
        setActiveIndex(0);
        return;
      }
      if (orderedResults.length === 0) return;
      setActiveIndex((index) => (index <= 0 ? orderedResults.length - 1 : index - 1));
      return;
    }
    if (event.key === 'Enter') {
      if (showResults && activeItem) {
        event.preventDefault();
        selectItem(activeItem);
        return;
      }
      if (trimmed) {
        event.preventDefault();
        submit();
      }
      return;
    }
    if (event.key === 'Escape') {
      close();
      return;
    }
    if (event.key === 'Tab') close();
  };

  return (
    <Box data-testid={testId} sx={{ position: variant === 'header' ? 'relative' : undefined }}>
      <TextField
        fullWidth
        size={variant === 'header' ? 'small' : 'medium'}
        autoFocus={autoFocus}
        label={label}
        value={query}
        onChange={(event) => {
          setQuery(event.target.value);
          setOpen(true);
          setActiveIndex(-1);
        }}
        onFocus={() => setOpen(true)}
        onBlur={() => window.setTimeout(() => setOpen(false), 120)}
        onKeyDown={handleKeyDown}
        placeholder={variant === 'header' ? 'Search' : 'e.g. health, dubbo, waternsw, hunter wter'}
        helperText={
          variant === 'header'
            ? undefined
            : 'Typo-tolerant over a bounded discovery index (functions, regions, sources, 10 state-owned entities). Press Enter to search every measure.'
        }
        FormHelperTextProps={variant === 'header' ? undefined : { id: helperId }}
        inputProps={{
          role: 'combobox',
          'aria-expanded': showResults,
          'aria-controls': listboxId,
          'aria-autocomplete': 'list',
          'aria-haspopup': 'listbox',
          'aria-activedescendant': activeItem ? optionId(activeIndex) : undefined,
          'aria-describedby': variant === 'header' ? undefined : helperId,
          autoComplete: 'off',
          spellCheck: false,
          maxLength: 100,
        }}
        InputProps={{
          endAdornment: (
            <InputAdornment position="end">
              <IconButton
                aria-label="Search all spending"
                edge="end"
                size="small"
                onClick={submit}
                tabIndex={-1}
              >
                <SearchIcon fontSize="small" />
              </IconButton>
            </InputAdornment>
          ),
        }}
        sx={
          variant === 'header'
            ? {
                '& .MuiInputBase-root': { backgroundColor: 'background.paper' },
                '& .MuiInputLabel-root': { backgroundColor: 'background.paper', px: 0.5 },
              }
            : undefined
        }
      />

      {showResults ? (
        <Paper
          id={listboxId}
          role="listbox"
          aria-label="Search suggestions"
          data-testid={`${testId}-results`}
          variant="outlined"
          onMouseDown={(event) => event.preventDefault()}
          sx={{
            position: variant === 'header' ? 'absolute' : 'relative',
            top: variant === 'header' ? 'calc(100% + 4px)' : undefined,
            left: variant === 'header' ? 0 : undefined,
            width: variant === 'header' ? 'min(420px, 82vw)' : '100%',
            zIndex: (theme) => theme.zIndex.modal,
            mt: variant === 'header' ? 0 : 1,
            p: 1,
            maxHeight: 440,
            overflowY: 'auto',
          }}
        >
          {discovery.loading && searchResults.length === 0 ? (
            <Box
              sx={{ display: 'flex', alignItems: 'center', gap: 1, p: 1 }}
              role="status"
              data-testid="quick-search-loading"
            >
              <CircularProgress size={16} />
              <Typography variant="caption" color="text.secondary">
                Loading the bounded discovery index…
              </Typography>
            </Box>
          ) : null}

          {discovery.error && searchResults.length === 0 && !discovery.loading ? (
            <Typography variant="body2" color="error" sx={{ p: 1 }}>
              Discovery index unavailable: {discovery.error}
            </Typography>
          ) : null}

          {noResults ? (
            <Box sx={{ p: 1 }} data-testid="quick-search-no-results">
              <Typography variant="body2" color="text.secondary">
                No function, region, data source or state-owned entity matches “{trimmed}”. Nothing
                is invented.
              </Typography>
              {suggestion ? (
                <Typography variant="body2" sx={{ mt: 0.5 }} data-testid="quick-search-suggestion">
                  Did you mean <RouterLink to={suggestion.href}>{suggestion.label}</RouterLink>?
                </Typography>
              ) : null}
            </Box>
          ) : null}

          {groups.map((group) => {
            const headingId = `${listboxId}-${group.kind}`;
            return (
              <Box key={group.kind} role="group" aria-labelledby={headingId} sx={{ mb: 0.5 }}>
                <Typography
                  id={headingId}
                  variant="overline"
                  color="text.secondary"
                  component="div"
                  sx={{ px: 1 }}
                >
                  {group.label} ({group.items.length})
                </Typography>
                {group.items.map((item) => {
                  const index = orderedResults.indexOf(item);
                  return (
                    <ListItemButton
                      key={item.id}
                      id={optionId(index)}
                      role="option"
                      aria-selected={index === activeIndex}
                      component={RouterLink}
                      to={item.href}
                      data-testid={OPTION_TEST_IDS[item.kind]}
                      onClick={(event) => {
                        event.preventDefault();
                        selectItem(item);
                      }}
                      onMouseEnter={() => setActiveIndex(index)}
                      selected={index === activeIndex}
                      sx={{ borderRadius: 1 }}
                    >
                      <ListItemText primary={item.label} secondary={item.secondary} />
                    </ListItemButton>
                  );
                })}
                {groups[groups.length - 1] !== group ? <Divider sx={{ my: 0.5 }} /> : null}
              </Box>
            );
          })}

          {searchResults.length > 0 ? (
            <Typography
              variant="caption"
              component="div"
              color="text.secondary"
              sx={{ px: 1, pt: 0.5 }}
            >
              Bounded discovery results only. Press Enter to search all spending rows in the
              explorer.
            </Typography>
          ) : null}
        </Paper>
      ) : null}
    </Box>
  );
}

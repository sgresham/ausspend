import { useState, type ReactNode } from 'react';
import { Link as RouterLink, Outlet, useLocation } from 'react-router-dom';
import {
  AppBar,
  Box,
  Divider,
  Drawer,
  IconButton,
  List,
  ListItemButton,
  ListItemIcon,
  ListItemText,
  Toolbar,
  Typography,
} from '@mui/material';
import AccountBalanceIcon from '@mui/icons-material/AccountBalance';
import DatasetIcon from '@mui/icons-material/Dataset';
import InfoIcon from '@mui/icons-material/Info';
import { CoverageBanner } from './CoverageBanner';
import { Footer } from './Footer';
import FunctionsIcon from '@mui/icons-material/Functions';
import HomeIcon from '@mui/icons-material/Home';
import MapIcon from '@mui/icons-material/Map';
import MenuIcon from '@mui/icons-material/Menu';
import PlaceIcon from '@mui/icons-material/Place';
import SearchIcon from '@mui/icons-material/Search';
import AssessmentIcon from '@mui/icons-material/Assessment';
import CorporateFareIcon from '@mui/icons-material/CorporateFare';

const DRAWER_WIDTH = 248;

interface NavItem {
  label: string;
  to: string;
  icon: ReactNode;
}

const NAV_ITEMS: NavItem[] = [
  { label: 'Home', to: '/', icon: <HomeIcon /> },
  { label: 'Search', to: '/search', icon: <SearchIcon /> },
  { label: 'Functions', to: '/functions', icon: <FunctionsIcon /> },
  { label: 'Regions', to: '/regions', icon: <MapIcon /> },
  { label: 'States', to: '/states', icon: <PlaceIcon /> },
  { label: 'GFS benchmark', to: '/benchmark', icon: <AssessmentIcon /> },
  { label: 'NSW SOC', to: '/soc', icon: <CorporateFareIcon /> },
  { label: 'Data sources', to: '/data-sources', icon: <DatasetIcon /> },
  { label: 'About', to: '/about', icon: <InfoIcon /> },
];

function NavList({ onNavigate }: { onNavigate?: () => void }) {
  const location = useLocation();

  return (
    <List>
      {NAV_ITEMS.map((item) => {
        const selected =
          item.to === '/' ? location.pathname === '/' : location.pathname.startsWith(item.to);
        return (
          <ListItemButton
            key={item.to}
            component={RouterLink}
            to={item.to}
            selected={selected}
            onClick={onNavigate}
          >
            <ListItemIcon>{item.icon}</ListItemIcon>
            <ListItemText primary={item.label} />
          </ListItemButton>
        );
      })}
    </List>
  );
}

export function Layout() {
  const [mobileOpen, setMobileOpen] = useState(false);

  const closeMobile = () => setMobileOpen(false);

  const drawer = (
    <Box sx={{ width: DRAWER_WIDTH }} role="navigation" aria-label="Main navigation">
      <Toolbar sx={{ gap: 1 }}>
        <AccountBalanceIcon color="primary" />
        <Typography variant="h6" component="span" noWrap>
          ausspend
        </Typography>
      </Toolbar>
      <Divider />
      <NavList onNavigate={closeMobile} />
    </Box>
  );

  return (
    <Box sx={{ display: 'flex', minHeight: '100vh' }}>
      <AppBar
        position="fixed"
        sx={{
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          ml: { md: `${DRAWER_WIDTH}px` },
        }}
      >
        <Toolbar>
          <IconButton
            color="inherit"
            edge="start"
            aria-label="Open navigation"
            onClick={() => setMobileOpen(true)}
            sx={{ mr: 2, display: { md: 'none' } }}
          >
            <MenuIcon />
          </IconButton>
          <Typography
            variant="h6"
            component={RouterLink}
            to="/"
            sx={{ color: 'inherit', textDecoration: 'none' }}
          >
            Australian government spending
          </Typography>
        </Toolbar>
      </AppBar>

      <Box component="nav" sx={{ width: { md: DRAWER_WIDTH }, flexShrink: { md: 0 } }}>
        <Drawer
          variant="temporary"
          open={mobileOpen}
          onClose={closeMobile}
          ModalProps={{ keepMounted: true }}
          sx={{ display: { xs: 'block', md: 'none' } }}
        >
          {drawer}
        </Drawer>
        <Drawer
          variant="permanent"
          open
          sx={{
            display: { xs: 'none', md: 'block' },
            '& .MuiDrawer-paper': { width: DRAWER_WIDTH, boxSizing: 'border-box' },
          }}
        >
          {drawer}
        </Drawer>
      </Box>

      <Box
        component="main"
        sx={{
          flexGrow: 1,
          width: { md: `calc(100% - ${DRAWER_WIDTH}px)` },
          p: { xs: 2, sm: 3 },
        }}
      >
        <Toolbar />
        <Box sx={{ maxWidth: 1100, mx: 'auto' }}>
          <CoverageBanner />
          <Outlet />
          <Footer />
        </Box>
      </Box>
    </Box>
  );
}

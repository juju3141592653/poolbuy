/** App shell: picks the screen for the current hash route. */
import { Footer, FlashBanner, Header, PageHeading } from './components/Layout';
import { JoinConfirm } from './pages/JoinConfirm';
import { MyPools } from './pages/MyPools';
import { PoolDetail } from './pages/PoolDetail';
import { PoolList } from './pages/PoolList';
import { StartPool } from './pages/StartPool';
import { useRoute } from './state/router';
import { useStore } from './state/context';

export default function App() {
  const route = useRoute();
  const { state } = useStore();

  let page;
  switch (route.name) {
    case 'list':
      page = <PoolList />;
      break;
    case 'detail':
      // Keyed by user so the join form resets when the demo user changes.
      page = <PoolDetail key={`${route.poolId}-${state.currentUserId}`} poolId={route.poolId} />;
      break;
    case 'join':
      page = <JoinConfirm key={state.currentUserId} poolId={route.poolId} qtyRaw={route.qty} />;
      break;
    case 'start':
      page = <StartPool />;
      break;
    case 'my':
      page = <MyPools key={state.currentUserId} />;
      break;
    default:
      page = (
        <div>
          <PageHeading>Page not found</PageHeading>
          <a href="#/" className="font-semibold text-primary underline">Back to all pools</a>
        </div>
      );
  }

  return (
    <div className="flex min-h-screen flex-col bg-canvas">
      <a href="#main" className="sr-only focus:not-sr-only focus:absolute focus:left-2 focus:top-2 focus:z-50 focus:rounded focus:bg-primary focus:text-on-primary focus:px-3 focus:py-2 focus:font-semibold"
        onClick={(e) => { e.preventDefault(); document.getElementById('main')?.focus(); }}>
        Skip to content
      </a>
      <Header route={route} />
      <FlashBanner />
      <main id="main" tabIndex={-1} className="mx-auto w-full max-w-7xl flex-1 px-4 py-6 outline-none">
        {page}
      </main>
      <Footer />
    </div>
  );
}

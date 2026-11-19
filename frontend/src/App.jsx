import { NavLink, Route, Routes } from 'react-router-dom';
import AuctionList from './pages/AuctionList.jsx';
import CreateRFQ from './pages/CreateRFQ.jsx';
import AuctionDetails from './pages/AuctionDetails.jsx';

export default function App() {
  return (
    <>
      <header className="topbar">
        <div className="container topbar-inner">
          <span className="brand">RFQ Auctions</span>
          <nav>
            <NavLink to="/" end>
              Auctions
            </NavLink>
            <NavLink to="/rfqs/new">New RFQ</NavLink>
          </nav>
        </div>
      </header>

      <main className="container">
        <Routes>
          <Route path="/" element={<AuctionList />} />
          <Route path="/rfqs/new" element={<CreateRFQ />} />
          <Route path="/rfqs/:id" element={<AuctionDetails />} />
          <Route path="*" element={<p>Page not found.</p>} />
        </Routes>
      </main>
    </>
  );
}

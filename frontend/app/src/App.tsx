import './App.css';
import { HomePage } from './pages/home/HomePage';
import { ChamadosPage } from './pages/chamados/ChamadosPage';
import { AuthPage } from './pages/auth/AuthPage';
import {BrowserRouter, Routes, Route, Navigate} from "react-router-dom";

function App() {
  return (
    <div className='App'>
      <BrowserRouter>
        <Routes>
          <Route path="/" element={<HomePage/>}></Route>  
          <Route path="/auth/login" element={<AuthPage/>}></Route>  
          <Route path="/chamados/" element={<ChamadosPage/>}></Route>  
        </Routes>
      </BrowserRouter>
    </div>
  );
}

export default App;

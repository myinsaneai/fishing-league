import {createRoot} from 'react-dom/client';
import {BrowserRouter} from 'react-router-dom';
import {AuthProvider} from './auth';
import {AppProvider} from './store';
import {ClubsProvider} from './clubsStore';
import App from './App';
import './styles.css';
createRoot(document.getElementById('root')).render(<BrowserRouter><AuthProvider><ClubsProvider><AppProvider><App/></AppProvider></ClubsProvider></AuthProvider></BrowserRouter>);

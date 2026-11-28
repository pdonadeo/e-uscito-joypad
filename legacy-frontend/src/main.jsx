import React from "react";
import ReactDOM from "react-dom/client";
import App from "./App";
import JoycordChannels from "./JoycordChannels";

import { createBrowserRouter, RouterProvider } from "react-router-dom";

import { SearchContextProvider } from "./store/search-context";

const router = createBrowserRouter([
  {
    path: "/",
    element: (
      <SearchContextProvider>
        <App />
      </SearchContextProvider>
    ),
  },
  {
    path: "/se-ne-parla-qui/:selectedGameIdUrl/:searchInputUrl",
    element: (
      <SearchContextProvider>
        <App />
      </SearchContextProvider>
    ),
  },
  {
    path: "/joycord/channels",
    element: <JoycordChannels />,
  },
]);

const root = ReactDOM.createRoot(document.getElementById("root"));
root.render(
  <React.StrictMode>
    <RouterProvider router={router} />
  </React.StrictMode>,
);

"use client";

import { createContext, useContext } from "react";

type ClientFeatures = {
  includesNutrition: boolean;
};

export const ClientFeaturesContext = createContext<ClientFeatures>({
  includesNutrition: true,
});

export const useClientFeatures = () => useContext(ClientFeaturesContext);

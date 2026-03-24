import React from "react";
import { Redirect } from "expo-router";

export default function GitHubAuthCallbackScreen() {
  // GitHub deep-link callback can open this route in Expo Router.
  // Immediately route users back to the main dashboard tabs.
  return <Redirect href="/dashboard" />;
}

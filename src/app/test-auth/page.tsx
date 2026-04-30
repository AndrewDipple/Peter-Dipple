"use client";

import { useEffect, useState } from "react";
import { supabase } from "@/lib/supabase";

export default function TestAuthPage() {
  const [authUser, setAuthUser] = useState<any>(null);
  const [clientData, setClientData] = useState<any>(null);
  const [error, setError] = useState<string>("");

  useEffect(() => {
    const test = async () => {
      // Test 1: Get auth user
      const { data: { user }, error: authError } = await supabase.auth.getUser();
      console.log("Auth User:", user);
      console.log("Auth Error:", authError);
      setAuthUser(user);

      if (!user) {
        setError("No authenticated user");
        return;
      }

      // Test 2: Query clients table
      const { data, error: queryError } = await supabase
        .from("clients")
        .select("*")
        .eq("profile_id", user.id)
        .maybeSingle();

      console.log("Client Data:", data);
      console.log("Query Error:", queryError);
      setClientData(data);

      if (queryError) {
        setError(queryError.message);
      }
    };

    test();
  }, []);

  return (
    <div className="p-6">
      <h1 className="text-2xl font-bold mb-4">Auth Test Page</h1>
      
      <div className="space-y-4">
        <div className="border p-4 rounded">
          <h2 className="font-bold">Auth User:</h2>
          <pre className="text-xs">{JSON.stringify(authUser, null, 2)}</pre>
        </div>

        <div className="border p-4 rounded">
          <h2 className="font-bold">Client Data:</h2>
          <pre className="text-xs">{JSON.stringify(clientData, null, 2)}</pre>
        </div>

        {error && (
          <div className="border border-red-500 p-4 rounded bg-red-50">
            <h2 className="font-bold text-red-800">Error:</h2>
            <p className="text-red-600">{error}</p>
          </div>
        )}
      </div>
    </div>
  );
}
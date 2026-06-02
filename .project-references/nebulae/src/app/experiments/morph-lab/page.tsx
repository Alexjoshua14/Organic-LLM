"use client";

import { useState } from "react";
import MorphTestContainer from "@/experiments/morph-lab/MorphTestContainer";
import { SpringConfigControls } from "@/experiments/morph-lab/components/SpringConfigControls";
import { slow_spring_config, SpringPreset } from "@/lib/morphTest/constants";
import { SpringConfig } from "@/lib/morphTest/schemas/springSolverSchemas";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import MorphCanvas from "@/experiments/morph-lab/MorphCanvas";


export default function MorphLabPage() {
  const [springConfig, setSpringConfig] = useState<SpringConfig>(slow_spring_config);
  const [activePreset, setActivePreset] = useState<SpringPreset | "custom">("slow");

  const handleConfigChange = (config: SpringConfig) => {
    setSpringConfig(config);
  };

  const handlePresetSelect = (preset: SpringPreset | "custom") => {
    setActivePreset(preset);
  };

  return (
    <main className="min-h-screen flex flex-col items-center justify-center px-4 py-16">
      <h1 className="text-4xl font-bold tracking-tight mb-4">
        Morph Lab Experiment
      </h1>
      <p className="text-lg text-muted-foreground max-w-xl text-center mb-8">
        Welcome to Morph Lab. This is a sandbox for exploring fluid morphing UI surfaces, transitions,
        and organic motion patterns. Start prototyping and remixing micro-interactions here.
      </p>

      {/* Spring Config Controls */}
      <div className="w-full max-w-xl mb-6">
        <SpringConfigControls
          config={springConfig}
          onConfigChange={handleConfigChange}
          onPresetSelect={handlePresetSelect}
          activePreset={activePreset}
        />
      </div>

      {/* Morph Demo */}
      <div className="rounded-2xl glass-surface w-full max-w-xl h-96 flex flex-col relative">
        <div className="flex-1 flex items-center justify-center">
          {/* shadcn/ui Tabs wrapper */}
          <Tabs defaultValue="gpu" className="w-full h-full">
            <TabsList className="mb-4">
              <TabsTrigger value="dom">CPU Powered</TabsTrigger>
              <TabsTrigger value="gpu">GPU Powered</TabsTrigger>
            </TabsList>
            <TabsContent value="dom" className="h-full flex items-center justify-center">
              <MorphTestContainer config={springConfig} />
            </TabsContent>
            <TabsContent value="gpu" className="h-full flex items-center justify-center">
              <MorphCanvas config={springConfig} />
            </TabsContent>
          </Tabs>
        </div>
      </div>
    </main>
  );
}

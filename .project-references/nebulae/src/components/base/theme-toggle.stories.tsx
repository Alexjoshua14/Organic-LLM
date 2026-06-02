import type { Meta, StoryObj } from '@storybook/react';
import { Button } from './button';
import { Moon, Sun } from 'lucide-react';
import * as React from 'react';

// Create a version of ThemeToggle without fixed positioning for Storybook
function ThemeToggleStory() {
  const [isDark, setIsDark] = React.useState(false);

  React.useEffect(() => {
    const stored = localStorage.getItem('theme');
    const prefersDark = window.matchMedia('(prefers-color-scheme: dark)').matches;
    const shouldBeDark = stored === 'dark' || (!stored && prefersDark);

    setIsDark(shouldBeDark);
    if (shouldBeDark) {
      document.documentElement.classList.add('dark');
    } else {
      document.documentElement.classList.remove('dark');
    }
  }, []);

  const toggleTheme = () => {
    const newIsDark = !isDark;
    setIsDark(newIsDark);

    if (newIsDark) {
      document.documentElement.classList.add('dark');
      localStorage.setItem('theme', 'dark');
    } else {
      document.documentElement.classList.remove('dark');
      localStorage.setItem('theme', 'light');
    }
  };

  return (
    <Button
      variant="secondary"
      size="icon"
      onClick={toggleTheme}
      className="cursor-pointer bg-white dark:bg-neutral-800 border border-neutral-200 dark:border-neutral-700 shadow-sm text-neutral-900 dark:text-neutral-100 hover:bg-neutral-100 dark:hover:bg-neutral-700 transition-colors"
      aria-label="Toggle theme"
    >
      {isDark ? <Sun className="h-4 w-4" /> : <Moon className="h-4 w-4" />}
    </Button>
  );
}

const meta = {
  title: 'Base/ThemeToggle',
  component: ThemeToggleStory,
  parameters: {
    layout: 'centered',
  },
  tags: ['autodocs'],
  argTypes: {},
} satisfies Meta<typeof ThemeToggleStory>;

export default meta;
type Story = StoryObj<typeof meta>;

export const Default: Story = {
  render: () => (
    <div className="flex flex-col items-center gap-4">
      <ThemeToggleStory />
      <p className="text-sm text-neutral-600 dark:text-neutral-400 max-w-md text-center">
        Theme toggle button. In actual usage, it's positioned fixed in the top-right corner of the viewport.
      </p>
    </div>
  ),
};

export const InContext: Story = {
  render: () => (
    <div className="w-full max-w-2xl">
      <div className="relative p-8 bg-linear-to-br from-neutral-50 via-neutral-100 to-neutral-300 dark:from-neutral-950 dark:via-neutral-900 dark:to-neutral-700 rounded-lg">
        <div className="absolute top-4 right-4">
          <ThemeToggleStory />
        </div>
        <div className="pr-20">
          <h3 className="text-lg font-medium mb-3 text-neutral-900 dark:text-neutral-50">
            Example Context
          </h3>
          <p className="text-sm text-neutral-700 dark:text-neutral-300 leading-relaxed mb-2">
            The theme toggle appears in the top-right corner of the page. Click it to switch between light and dark themes.
          </p>
          <p className="text-xs text-neutral-600 dark:text-neutral-400 italic">
            Note: In Storybook, you can also use the theme switcher in the toolbar to test dark mode.
          </p>
        </div>
      </div>
    </div>
  ),
};


# Recipe Calculator Draft 1

This is a Vite + React + TypeScript application for the Meetha Pitara Recipe Calculator.

## Getting Started

### Prerequisites

- Node.js (v18 or higher recommended)
- npm or yarn

### Installation

1.  Clone the repository:
    ```bash
    git clone <repository-url>
    ```
2.  Navigate to the project directory:
    ```bash
    cd recipe_calc_draft_1
    ```
3.  Install dependencies:
    ```bash
    npm install
    ```

### Environment Setup

1.  Copy the example environment file:
    ```bash
    cp .env.example .env
    ```
2.  Open `.env` and configure your variables:
    -   `VITE_SUPABASE_URL`: Your Supabase project URL.
    -   `VITE_SUPABASE_PUBLISHABLE_KEY`: Your Supabase Anon/Public key.
    -   `VITE_ENABLE_ADVANCED`: Set to `true` to enable advanced calculator features.
    -   `NEXT_PUBLIC_DEBUG_MODE`: Set to `true` for debug logging.

    have sent this on whatsapp

### Running the App

Start the development server:

```bash
npm run dev
```

The application will be available at `http://localhost:8080` (or the port shown in your terminal).




## Technologies

-   **Vite**: Build tool and dev server.
-   **React**: UI library.
-   **TypeScript**: Type safety.
-   **Tailwind CSS**: Styling.
-   **Shadcn UI**: Component library.
-   **Supabase**: Backend and authentication.

import Link from "next/link";
import Logo from "./Logo";
import { styles } from "@/lib/design";

type Props = {
  title: string;
  backHref?: string;
  rightAction?: React.ReactNode;
  showClientNav?: boolean;
  showTrainerNav?: boolean;
};

export default function PageHeader({
  title,
  backHref,
  rightAction,
  showClientNav = false,
  showTrainerNav = false,
}: Props) {
  return (
    
    <div className="mb-6 space-y-4">
      <div className="flex items-center gap-4">
        <Logo />
        <h1 className={`${styles.heading} ${styles.goldText} min-w-0`}>
          {title}
        </h1>
      </div>

      <div className="flex flex-wrap items-center gap-2">
        {showClientNav && (
          <>
            <Link href="/client/dashboard" className={styles.buttonSecondary}>
              Home
            </Link>
            <Link href="/client/workout" className={styles.buttonSecondary}>
              Workout
            </Link>
            <Link href="/client/nutrition" className={styles.buttonSecondary}>
              Nutrition
            </Link>
            <Link href="/client/stats" className={styles.buttonSecondary}>
              My Stats
            </Link>
            <Link href="/client/meal-planner" className={styles.buttonSecondary}>
              Meal Planner
            </Link>
            <Link href="/client/shopping-list" className={styles.buttonSecondary}>
              Shopping List
            </Link>
          </>
        )}

        {showTrainerNav && (
          <>
            <Link href="/trainer/dashboard" className={styles.buttonSecondary}>
              Dashboard
            </Link>
            <Link href="/trainer/clients/new" className={styles.buttonSecondary}>
              Add Client
            </Link>
            <Link href="/trainer/clients" className={styles.buttonSecondary}>
              View Clients
            </Link>
            <Link href="/trainer/recipes/new" className={styles.buttonSecondary}>
              Add Recipe
            </Link>
            <Link href="/trainer/recipes" className={styles.buttonSecondary}>
              View Recipes
            </Link>
            <Link href="/trainer/program-templates" className={styles.buttonSecondary}>
              Programme Templates
            </Link>
          </>
        )}

        {backHref && (
          <Link href={backHref} className={styles.buttonPrimary}>
            Back
          </Link>
        )}

        {rightAction}
      </div>
    </div>
  );
}
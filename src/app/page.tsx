import Link from "next/link";
import { UsernameForm } from "@/ui/home/UsernameForm";

const EXAMPLES = ["torvalds", "sindresorhus", "vercel"];

export default function HomePage() {
  return (
    <main className="home">
      <h1>CommitCity</h1>
      <p className="tagline">Your code. Your city.</p>
      <p>
        Every public repository becomes a building. Older code sits in the center, busier
        repositories grow taller, and archived ones gather dust.
      </p>
      <UsernameForm />
      <p className="examples">
        Or visit{" "}
        {EXAMPLES.map((login, i) => (
          <span key={login}>
            {i > 0 && ", "}
            <Link href={`/u/${login}`}>{login}</Link>
          </span>
        ))}
        .
      </p>
      <footer>
        <a href="https://github.com/commitcity/commitcity">Open source on GitHub</a>
      </footer>
    </main>
  );
}

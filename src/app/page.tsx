import Link from "next/link";
import { BackdropCity } from "@/ui/home/BackdropCity";
import { Book } from "@/ui/home/Book";
import { UsernameForm } from "@/ui/home/UsernameForm";

const EXAMPLES = ["torvalds", "sindresorhus", "vercel"];

export default function HomePage() {
  return (
    <main className="ui home">
      <BackdropCity />
      <Book
        title="CommitCity"
        subtitle="Your code. Your city."
        leftLabel="About"
        rightLabel="Find a city"
        left={
          <>
            <h1>CommitCity</h1>
            <p className="home-tagline">Your code. Your city.</p>
            <ul className="home-rules">
              <li>Every public repository becomes a building.</li>
              <li>The oldest code sits in the center of town.</li>
              <li>Busy repositories grow taller.</li>
              <li>Archived ones gather dust and weeds.</li>
            </ul>
            <p className="home-footer">
              <a href="https://github.com/commitcity/commitcity">Open source on GitHub</a>
            </p>
          </>
        }
        right={
          <>
            <h2>Whose city shall we visit?</h2>
            <UsernameForm />
            <p className="home-examples">
              Or visit{" "}
              {EXAMPLES.map((login, i) => (
                <span key={login}>
                  {i > 0 && ", "}
                  <Link href={`/u/${login}`}>{login}</Link>
                </span>
              ))}
              .
            </p>
          </>
        }
      />
    </main>
  );
}

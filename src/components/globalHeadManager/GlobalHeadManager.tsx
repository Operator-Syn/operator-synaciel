export default function GlobalHeadManager() {
    return (
        <>
            <title>Operator-Syn | Portfolio & Homepage</title>
            <meta
                name="description"
                content="John-Ronan Beira’s portfolio — a collection of milestones shaped by exploration in software technologies."
            />
            <link rel="icon" href="/assets/profile-encircle-min.png" type="image/png" />

            {/* Open Graph */}
            <meta property="og:title" content="Operator-Syn | Portfolio & Homepage" />
            <meta
                property="og:description"
                content="Discover John-Ronan Beira’s portfolio — a Computer Science student skilled in Java, C++, Python, MySQL, Linux, and more."
            />
            <meta property="og:image" content="https://personal-portfolio-bucket.syn-forge.com/ProfilePicture/preview.png" />
            <meta property="og:url" content="https://syn-forge.com/" />
            <meta property="og:type" content="website" />

            {/* Twitter Card */}
            <meta name="twitter:card" content="summary_large_image" />
            <meta name="twitter:title" content="Operator-Syn | Portfolio & Homepage" />
            <meta
                name="twitter:description"
                content="Discover John-Ronan Beira’s portfolio — a Computer Science student skilled in Java, C++, Python, MySQL, Linux, and more."
            />
            <meta name="twitter:image" content="https://personal-portfolio-bucket.syn-forge.com/ProfilePicture/preview.png" />
        </>
    );
}

import React from 'react';

const ContactCard = ({ icon, title, content, link, linkLabel }) => {
  const isEmail = link.includes('@');
  const isPhone = /^\+?[0-9\s-]{10,}$/.test(link);

  let formattedLink = link;
  if (isEmail) formattedLink = `mailto:${link}`;
  else if (isPhone) formattedLink = `tel:${link.replace(/\D/g, '')}`;

  return (
    /* Glass Card: Added backdrop-blur and border-white/20 */
    <div className="group relative w-full max-w-[320px] bg-white/20 backdrop-blur-md border border-white/30 p-8 rounded-3xl shadow-2xl transition-all duration-500 hover:bg-white/30 hover:-translate-y-3 flex flex-col items-center text-center">
      
      {/* Glow Effect behind icon */}
      <div className="absolute -top-4 -right-4 w-24 h-24 bg-violet-500/20 rounded-full blur-2xl group-hover:bg-violet-500/40 transition-all duration-500" />

      {/* Icon Container */}
      <div className="mb-6 p-4 rounded-2xl bg-white/20 shadow-inner transition-transform duration-500 group-hover:rotate-[360deg]">
        <img src={icon} alt={title} className="w-8 h-8" />
      </div>

      <h3 className="text-xl font-bold text-white mb-3">{title}</h3>
      <p className="text-white/70 mb-6 leading-relaxed text-sm font-medium">
        {content}
      </p>
      
      <a 
        href={formattedLink} 
        className="mt-auto px-6 py-2 rounded-full bg-violet-600 text-white font-semibold shadow-lg hover:bg-violet-700 hover:shadow-violet-500/40 transition-all duration-300 active:scale-95"
      >
        {linkLabel || link}
      </a>
    </div>
  );
};

function Contact() {
  return (
    /* Background with a subtle gradient to make the glass pop */
    <section className="relative py-20 px-6  overflow-hidden min-h-screen flex items-center">
      
      {/* Abstract Background Blobs for Glass depth */}
      <div className="absolute top-[-10%] left-[-10%] w-[40%] h-[40%] rounded-full bg-violet-200/50 blur-[120px]" />
      <div className="absolute bottom-[-10%] right-[-10%] w-[40%] h-[40%] rounded-full bg-blue-200/50 blur-[120px]" />

      <div className="max-w-6xl mx-auto relative z-10">
        {/* Header Section */}
        <div className="text-center mb-16">
          <span className="text-violet-600 font-bold tracking-widest uppercase text-sm">Get in touch</span>
          <h1 className="text-5xl md:text-6xl font-black text-white mt-4 mb-6 tracking-tight">
            We Would love to <span className="text-transparent bg-clip-text bg-gradient-to-r from-violet-600 to-indigo-600">hear from you.</span>
          </h1>
          <p className="text-lg text-white/70 max-w-2xl mx-auto font-medium">
            Have questions about BlockTix? Our team is here to help you secure the future of ticketing.
          </p>
        </div>

        {/* Cards Container */}
        <div className="flex flex-wrap justify-center gap-10">
          <ContactCard
            icon="https://www.svgrepo.com/show/502647/email-open.svg"
            title="Email Us"
            content="Our support team usually responds within 24 hours to all inquiries."
            link="support@blocktix.com"
          />

          <ContactCard
            icon="https://www.svgrepo.com/show/524804/phone-rounded.svg"
            title="Call Us"
            content="Talk to a human. Available Monday through Friday, 9am to 5pm EST."
            link="+11234567890"
            linkLabel="(123) 456-7890"
          />

          <ContactCard
            icon="https://www.svgrepo.com/show/502698/help-question.svg"
            title="Help Center"
            content="Ready to dive in? Check out our guides and community documentation."
            link="/help"
            linkLabel="View FAQ"
          />
        </div>
      </div>
    </section>
  );
}

export default Contact;
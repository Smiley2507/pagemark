# Important part of page
---------------------------
it is a multitenant AI assisted collaborative software documentation generation system.

## feature 1: Login/Signup process
----------------------------
- since it is multi-tenant, we have to treat as such in the backend and database, by adding role based login and allow users to create organizations and team and invite people to join them to collaborate on the project.

- the signup will be sofisticated , including onboarding screens to allow the user to setup most of everything on sign up and a complete and comphensive setting page with sections to allow the user to modify every thing else.

- implement secure login, with OTP verification on login, and email verification with otp on sign up.

## feature 2: Projects and codebase analysis
-----------------------------------------------
- this the main part of the dashboard when users view their projects and create new ones. on just the dashboard they should be able to change the project name and description. we can also implement a details pop up that tells you about the project at a glance: such as title, description, create date, last edited, completeness,categories (tags) and overall quality.

- the other important process is the project creation process. right now it only have 5 steps, but I plan to add more since there are important things that the process doesn't cover such input for the kind of document you want to generate and that is why we have template in the first place. there should be an input for that and some other things such as tags to help in organisation and categorization so that you can later filter with tags. 

- the project analysis and parsing works, but it could be better.we will have reduce the project we support to simply the project so that, we have something that work well with a few frameworks, instead of something that does good on all. we can eliminate project from bitbucket and gitlab and only support those on github. the language, since we only have three of the I think we can keep it as it is for now and iterate later.

## feature 3: the editor
---------------------------
this is the main page of the project, and it is probably the part that user will spend most time. I want to make is as distractions, and with only think that the user need to use, kinda like notion. it provides a premium writing experience.

- this feature is the one I spent most time on, also the one I am least satsified with (considering the amount of time I spent on it.).the thing that annoy me the most about this section even now is the TOC and editor. the Table of content is supposed to render H1 and H2 as the use add them, but now it doesn't do so, and wait for reload. as for the editor middle panel itself, what bugs most is the section organization. I don't like the section organisation at all. it doesn't make writing in them easy. Instead of feeling like you are free to write whatever you want, it gives you constraints that you have to work within. each section feels like a abox (it also looks like one since it has its own scroll) and this is not what I want. I am wondering if it is due to using codemirror, or my bad implementation of the logic. I am also considering switching to milkdown editor since my user but I am hesitating since i don't know if it will allow diffing.What I like about milkdown is that most of the feature I build on top of codemirror come built in. and since it is a md editor, it is block based and I think it would be easier for my usecase as well. Another option is MDXEditor.
Tables are also a pain in my editor.

- speaking of things I want to include in this editor, I want to be able to reference text by selection it or even the entire section in the AI panel so that the user can get. for sections you can use the @ in the AI panel. this will super charge writing.

- I am also unsatisfied with the ai panel. most of my dissatsifaction come from that the ai panel and the ai feature does not work at all. the design also looks bad. I think that the tab in the ai chat are confusing as well, since we have an Agent tab, a Chat tab and a history tab. I think agent and chat tab should be one tab. I also the history tab should be somewhere in the top bar. instead on the chat panel. 

- basically, the editor panel is a mess and an empty shell. we still have a lot to to do on this section.

## feature 4: the ai
-------------------------
for the AI, I wanted adopt the BYOK framework, and support a couple harnesses for this project (support more later if the project is profitable). it doesn't work as I expected, it also doesn't work how other ai projects implement it. I think we need to copy from another project how it does it and follow along the process. I also haven't figured out how this will work in my project, because it works in a multitenary project. we have to implement some rules:
	- after inserting api key, detect key information(identifies the developer account or organization that generated it, Usage qouta, project setting). the models that can be access with the key should also be dynamic and preinserted so that in the ai panel we will allow the user to select one that work for him. another thing in the ai setting, the user can register multiple api key but he has to set a primary one, while the rest will be secondary, but their models can be switched by the user in the ai panel (the composer)


### Feature 5: Exporting
-----------------------------------------
- the though of how I wanted to implement this is that I wanted the user to be simple to make a wiki into(markdown) as well as nicely designed pdf and html depending on the format you choose. basically I wanted to allow user some customization such as allowing font change (using google fonts), colors and background changes, header and footer designs , adding organization logo and so on. of we have to have a preview window that allow the user to see end results as they are applied. this will be specifically for pdfs and html. some of these features I think might need to be integrate in the editor instead, but it is worth considering.

## Other features:
------------------
other features are equally as important such as those to support the multitenary setup, like user management, permission and access management, role management as well as security feature such logging and monitoring. these will all be integrated in the dashboard. I plan to add a sidebar instead of a top bar on the dashboard and add pages for everything.

##Other thins to consider:
-----------------------------

- security (check for vulnerabilities, red teaming(simulate attacks))
- debugging (both logic and implementation bugs)
- code review and code cleanup
- bloat (removing unnecessary things.)
- code testing (Blackbox and whitebox)